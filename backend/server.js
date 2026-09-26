'use strict';

/**
 * Server bootstrap: connects to the database, creates missing tables and
 * starts the HTTP listener.
 *
 *   npm start        production-style start
 *   npm run dev      nodemon with reload
 */

const config = require('./config/env');
const { testConnection, describeConnection, dialect } = require('./config/database');
const { sequelize, syncDatabase } = require('./models');
const app = require('./app');

let server;

const start = async () => {
  console.log(
    `[boot] PracOffice backend starting (env=${config.env}, db=${dialect}, target=${describeConnection()})`
  );

  await testConnection();
  await syncDatabase();

  server = app.listen(config.server.port, config.server.host, () => {
    console.log(`[boot] API listening on http://localhost:${config.server.port}/api`);
    console.log(`[boot] health check: http://localhost:${config.server.port}/api/health`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[boot] port ${config.server.port} is already in use`);
    } else {
      console.error('[boot] server error', error);
    }
    process.exit(1);
  });
};

const shutdown = (signal) => {
  console.log(`\n[shutdown] received ${signal}, closing connections...`);

  const closeServer = () =>
    new Promise((resolve) => {
      if (!server) return resolve();
      server.close(() => resolve());
      return undefined;
    });

  closeServer()
    .then(() => sequelize.close())
    .then(() => {
      console.log('[shutdown] done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[shutdown] failed', error);
      process.exit(1);
    });
};

['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => shutdown(signal)));

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandled promise rejection', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[fatal] uncaught exception', error);
  shutdown('uncaughtException');
});

if (require.main === module) {
  start().catch((error) => {
    console.error('[boot] failed to start the server', error);
    process.exit(1);
  });
}

module.exports = { start };
