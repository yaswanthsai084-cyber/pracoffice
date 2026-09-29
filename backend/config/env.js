'use strict';

/**
 * Central runtime configuration for the PracOffice backend.
 *
 * PLAN.md specifies PostgreSQL as the database. The dialect can be switched to
 * SQLite (single file / in-memory) so the API can be run and tested locally
 * without a PostgreSQL server:
 *
 *   DB_DIALECT=sqlite   -> file (or :memory:) database, no server required
 *   DB_DIALECT=postgres -> PostgreSQL, configured through DATABASE_URL or PG* vars
 *
 * When no PostgreSQL related variable is present the dialect falls back to
 * sqlite in development/test. PostgreSQL is always required in production.
 */

const fs = require('fs');
const path = require('path');

// backend/.env (git-ignored) is loaded when present.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BACKEND_ROOT = path.resolve(__dirname, '..');

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Parses a TCP port that arrives through `.env`.
 * A typo fails loudly instead of silently connecting to the wrong port.
 *
 * The whole string is validated first, because `Number.parseInt('543Z', 10)`
 * happily returns 543 and `Number.parseInt('5O432', 10)` returns 5 - a
 * mistyped port would otherwise be accepted and then fail much later, with a
 * far more confusing "connection refused" error.
 */
const toPort = (value, fallback, name, min = 1) => {
  const raw = value === undefined || value === null ? '' : String(value).trim();
  if (raw === '') return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `${name} in .env must be a whole number between ${min} and 65535 (received "${raw}").`
    );
  }
  const parsed = Number(raw);
  if (parsed < min || parsed > 65535) {
    throw new Error(
      `${name} in .env must be between ${min} and 65535 (received "${raw}").`
    );
  }
  return parsed;
};

const splitList = (value, fallback = []) => {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';
const isDevelopment = !isProduction && !isTest;

const resolveDialect = () => {
  const explicit = (process.env.DB_DIALECT || '').trim().toLowerCase();
  if (explicit) {
    if (!['postgres', 'sqlite'].includes(explicit)) {
      throw new Error(
        `Unsupported DB_DIALECT "${explicit}". Use "postgres" or "sqlite".`
      );
    }
    return explicit;
  }

  const hasPostgresConfig = Boolean(
    process.env.DATABASE_URL ||
      process.env.DB_NAME ||
      process.env.PGHOST ||
      process.env.DB_HOST
  );

  return hasPostgresConfig ? 'postgres' : 'sqlite';
};

const dialect = resolveDialect();

if (isProduction && dialect !== 'postgres') {
  throw new Error(
    'Production requires PostgreSQL. Set DB_DIALECT=postgres plus DATABASE_URL (or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD).'
  );
}

const resolveJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (isProduction) {
    throw new Error(
      'JWT_SECRET must be set (min 16 characters) when NODE_ENV=production.'
    );
  }
  if (secret) return secret;
  return 'pracoffice-development-secret-do-not-use-in-production';
};

const sqliteStorage =
  process.env.DB_STORAGE ||
  path.join(BACKEND_ROOT, 'data', `pracoffice.${NODE_ENV}.sqlite`);

const postgresConnection = {
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: toPort(process.env.DB_PORT || process.env.PGPORT, 5432, 'DB_PORT'),
  database: process.env.DB_NAME || process.env.PGDATABASE || 'pracoffice',
  username: process.env.DB_USER || process.env.PGUSER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
  ssl: toBool(process.env.DB_SSL, false),
};

const config = {
  env: NODE_ENV,
  isProduction,
  isTest,
  isDevelopment,
  backendRoot: BACKEND_ROOT,

  server: {
    port: toPort(process.env.PORT, 3000, 'PORT', 0),
    host: process.env.HOST || '0.0.0.0',
  },

  cors: {
    // "*" (default) or a comma separated list of allowed origins.
    origins: splitList(process.env.CORS_ORIGIN, ['*']),
  },

  body: {
    jsonLimit: process.env.JSON_LIMIT || '2mb',
  },

  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'pracoffice',
  },

  bcrypt: {
    saltRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 10),
  },

  db: {
    dialect,
    logging: toBool(process.env.DB_LOGGING, false),
    syncAlter: toBool(process.env.DB_SYNC_ALTER, false),
    postgres: postgresConnection,
    sqlite: { storage: sqliteStorage },
  },
};

/**
 * Ensure the sqlite directory exists before Sequelize opens the file.
 * Safe to call multiple times.
 */
config.prepareStorage = () => {
  if (config.db.dialect !== 'sqlite') return;
  const storage = config.db.sqlite.storage;
  if (!storage || storage === ':memory:') return;
  fs.mkdirSync(path.dirname(storage), { recursive: true });
};

module.exports = config;
