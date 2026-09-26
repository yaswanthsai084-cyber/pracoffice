'use strict';

/**
 * Minimal request logger (no extra dependency needed).
 * Silenced during tests; enable SQL logs with DB_LOGGING=true.
 */

const config = require('../config/env');

const requestLogger = (req, res, next) => {
  if (config.isTest) return next();

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
    if (res.statusCode >= 500) console.error(`[http] ${line}`);
    else if (res.statusCode >= 400) console.warn(`[http] ${line}`);
    else console.log(`[http] ${line}`);
  });

  next();
};

module.exports = requestLogger;
