'use strict';

/**
 * Express application (no listener here - see server.js so the app can be
 * imported directly by the automated tests).
 *
 * Mounted routes:
 *   GET  /api/health
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/me
 */

const express = require('express');
const cors = require('cors');

const config = require('./config/env');
const apiRoutes = require('./routes');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');

// The React dev server runs on a different origin; allow it explicitly.
app.use(
  cors({
    origin: config.cors.origins.includes('*') ? true : config.cors.origins,
    credentials: true,
  })
);

app.use(express.json({ limit: config.body.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: config.body.jsonLimit }));
app.use(requestLogger);

app.get('/', (req, res) => {
  res.json({
    name: 'PracOffice API',
    version: require('./package.json').version,
    environment: config.env,
    docs: 'See backend/README.md for the full API reference.',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: config.env,
    database: config.db.dialect,
    time: new Date().toISOString(),
  });
});

app.use('/api', apiRoutes);

// Unmatched routes and errors are turned into the same JSON shape.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
