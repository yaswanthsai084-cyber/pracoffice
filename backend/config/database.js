'use strict';

/**
 * Sequelize instance shared by every model.
 *
 * PostgreSQL is the target database (PLAN.md). SQLite is supported as a
 * zero-setup fallback for local development and automated tests.
 */

const { Sequelize, DataTypes } = require('sequelize');
const config = require('./env');

config.prepareStorage();

const baseOptions = {
  dialect: config.db.dialect,
  logging: config.db.logging ? (message) => console.log(`[sequelize] ${message}`) : false,
  // PLAN.md column naming: snake_case columns, created_at only.
  define: {
    underscored: true,
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  },
  pool: { max: 10, min: 0, idle: 10000, acquire: 30000 },
};

const buildConnection = () => {
  if (config.db.dialect === 'postgres') {
    const pg = config.db.postgres;
    const options = {
      ...baseOptions,
      host: pg.host,
      port: pg.port,
      dialectOptions: pg.ssl
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
    };

    return pg.connectionString
      ? new Sequelize(pg.connectionString, options)
      : new Sequelize(pg.database, pg.username, pg.password, options);
  }

  return new Sequelize({ ...baseOptions, storage: config.db.sqlite.storage });
};

const sequelize = buildConnection();

/** JSONB on PostgreSQL (PLAN.md), plain JSON on the SQLite fallback. */
const jsonType = config.db.dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

const describeConnection = () => {
  if (config.db.dialect === 'postgres') {
    const pg = config.db.postgres;
    return pg.connectionString
      ? 'postgres://<redacted>'
      : `postgres://${pg.username}@${pg.host}:${pg.port}/${pg.database}`;
  }
  return `sqlite:${config.db.sqlite.storage}`;
};

/**
 * Builds a connection to the always-present `postgres` maintenance database.
 * Used only to create the application database when it is missing.
 */
const buildMaintenanceConnection = () => {
  const pg = config.db.postgres;
  const maintenanceDatabase = 'postgres';
  const ssl = pg.ssl ? { ssl: { rejectUnauthorized: false } } : {};

  if (pg.connectionString) {
    const url = new URL(pg.connectionString);
    url.pathname = `/${maintenanceDatabase}`;
    return { connectionString: url.toString(), ...ssl };
  }

  return {
    host: pg.host,
    port: pg.port,
    user: pg.username,
    password: pg.password,
    database: maintenanceDatabase,
    ...ssl,
  };
};

/** Resolves the database name to create/connect to, honouring DATABASE_URL. */
const resolveTargetDatabase = () => {
  const pg = config.db.postgres;
  if (pg.connectionString) {
    try {
      const name = decodeURIComponent(new URL(pg.connectionString).pathname.replace(/^\//, ''));
      if (name) return name;
    } catch {
      // Malformed URL: fall back to the discrete DB_* variables below.
    }
  }
  return pg.database;
};

/**
 * Creates the configured PostgreSQL database when it does not exist yet.
 *
 * `sequelize.sync()` creates tables but never the database itself, so a fresh
 * checkout configured with a new DB_NAME would otherwise fail to boot with
 * `database "..." does not exist`. Creating it here makes the first run work
 * without any manual `createdb` step.
 *
 * Best effort: if the maintenance connection or `CREATE DATABASE` is not
 * permitted, `sequelize.authenticate()` reports the real problem.
 *
 * @returns {Promise<{ created: boolean, database?: string }>}
 */
const ensureDatabase = async () => {
  if (config.db.dialect !== 'postgres') return { created: false };

  const target = resolveTargetDatabase();
  const { Client } = require('pg');
  const client = new Client(buildMaintenanceConnection());

  try {
    await client.connect();
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [target]);
    if (existing.rowCount > 0) return { created: false, database: target };

    const quoted = `"${String(target).replace(/"/g, '""')}"`;
    await client.query(`CREATE DATABASE ${quoted}`);
    return { created: true, database: target };
  } finally {
    await client.end().catch(() => {});
  }
};

const testConnection = async () => {
  try {
    const { created, database } = await ensureDatabase();
    if (created) console.log(`[db] created database "${database}"`);
  } catch {
    // Ignore: `authenticate()` below surfaces the actionable error message.
  }

  await sequelize.authenticate();
  console.log(`[db] connected (${describeConnection()})`);
  return true;
};

const closeConnection = async () => {
  await sequelize.close();
};

module.exports = {
  sequelize,
  Sequelize,
  DataTypes,
  jsonType,
  dialect: config.db.dialect,
  describeConnection,
  ensureDatabase,
  testConnection,
  closeConnection,
};
