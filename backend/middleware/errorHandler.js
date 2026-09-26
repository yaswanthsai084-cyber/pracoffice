'use strict';

/**
 * Central error handling: converts thrown errors into consistent JSON:
 *   { "message": "...", "errors": [{ "field": "...", "message": "..." }] }
 */

const config = require('../config/env');
const AppError = require('../utils/apiError');

/** 404 handler for unmatched routes. */
const notFound = (req, res, next) =>
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));

const fromSequelize = (error) => {
  switch (error.name) {
    case 'SequelizeValidationError':
      return {
        statusCode: 400,
        message: 'Validation failed',
        errors: (error.errors || []).map((item) => ({
          field: item.path,
          message: item.message,
        })),
      };
    case 'SequelizeUniqueConstraintError':
      return {
        statusCode: 409,
        message: 'That record already exists',
        errors: (error.errors || []).map((item) => ({
          field: item.path,
          message: `${item.path} must be unique`,
        })),
      };
    case 'SequelizeForeignKeyConstraintError':
      return { statusCode: 400, message: 'The related record does not exist' };
    case 'SequelizeConnectionRefusedError':
    case 'SequelizeConnectionError':
    case 'SequelizeAccessDeniedError':
      return { statusCode: 503, message: 'The database is unavailable. Please try again shortly.' };
    case 'SequelizeTimeoutError':
      return { statusCode: 504, message: 'The database took too long to respond' };
    default:
      return null;
  }
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'Unexpected server error';
  let errors = error.errors;

  const mapped = fromSequelize(error);
  if (mapped) ({ statusCode, message, errors } = mapped);

  if (error.type === 'entity.too.large') {
    statusCode = 413;
    message = 'The submitted document is too large';
  } else if (error.type === 'entity.parse.failed' || (error instanceof SyntaxError && 'body' in error)) {
    statusCode = 400;
    message = 'The request body contains invalid JSON';
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired authentication token';
  }

  if (statusCode >= 500) {
    console.error('[error]', error.message, config.isProduction ? '' : `\n${error.stack}`);
  } else if (!config.isTest) {
    // Include the field list on 4xx so a rejected form submission can be
    // diagnosed from the server log (e.g. "[warn] 400 Validation failed ...").
    const detail = Array.isArray(errors) && errors.length > 0 ? ` ${JSON.stringify(errors)}` : '';
    console.warn(`[warn] ${statusCode} ${message}${detail}`);
  }

  const payload = { message };
  if (Array.isArray(errors) && errors.length > 0) payload.errors = errors;
  if (error.code) payload.code = error.code;
  if (!config.isProduction && statusCode >= 500) payload.stack = error.stack;

  res.status(statusCode).json(payload);
};

/** Wraps an async handler so rejections reach the error handler. */
const wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

module.exports = { errorHandler, notFound, wrap };
