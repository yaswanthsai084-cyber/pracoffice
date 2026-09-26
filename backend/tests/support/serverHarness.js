'use strict';

/**
 * Test harness: sets the environment BEFORE any module (and therefore any
 * Sequelize configuration) is loaded, uses a throw-away SQLite database and
 * exposes a small helper for making HTTP requests against the Express app.
 *
 * Usage:
 *   const { startTestServer, api } = require('./support/serverHarness');
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = path.join(
  os.tmpdir(),
  `pracoffice-test-${process.pid}-${Date.now()}.sqlite`
);
process.env.DB_LOGGING = 'false';
process.env.JWT_SECRET = 'pracoffice-test-secret-key-1234567890';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4'; // keep the test suite fast
process.env.CORS_ORIGIN = '*';

// Requires happen after the environment is configured on purpose.
const app = require('../../app');
const { sequelize, syncDatabase } = require('../../models');

let server;
let baseUrl;

/** Creates the schema and starts an ephemeral listener. */
const startTestServer = async () => {
  if (baseUrl) return { server, baseUrl };

  await syncDatabase();

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { server, baseUrl };
};

const getBaseUrl = async () => {
  if (!baseUrl) await startTestServer();
  return baseUrl;
};

/** Minimal fetch wrapper returning { status, body }. */
const api = async (route, { method = 'GET', body, token, headers = {} } = {}) => {
  const url = `${await getBaseUrl()}${route}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (error) {
    parsed = text;
  }

  return { status: response.status, body: parsed };
};

/**
 * Registers a user with the same payload the frontend Registration page sends
 * and returns { status, body, credentials }.
 */
const registerUser = async (overrides = {}) => {
  // padStart keeps `unique` at exactly 10 characters so the generated mobile
  // number is always exactly 10 digits (a shorter one would be - rightly -
  // rejected by the API's validation).
  const unique =
    `${Date.now()}`.slice(-7) + `${Math.floor(Math.random() * 1000)}`.padStart(3, '0');
  const credentials = {
    username: `student${unique}`,
    email: `student${unique}@example.com`,
    mobileNumber: `9${unique}`.slice(0, 10),
    dateOfBirth: '2001-05-14',
    ...overrides,
  };

  const response = await api('/api/auth/register', { method: 'POST', body: credentials });
  return { ...response, credentials };
};

/** Stops the listener and removes the temporary database. */
const stopTestServer = async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = undefined;
    baseUrl = undefined;
  }

  await sequelize.close();

  const storage = process.env.DB_STORAGE;
  if (storage && storage !== ':memory:' && fs.existsSync(storage)) {
    fs.rmSync(storage, { force: true });
  }
};

module.exports = {
  startTestServer,
  stopTestServer,
  getBaseUrl,
  api,
  registerUser,
  app,
  sequelize,
};
