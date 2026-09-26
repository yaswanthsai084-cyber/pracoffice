'use strict';

/**
 * Operational error carrying an HTTP status code, so controllers can throw
 * instead of building responses by hand. The central error handler turns these
 * into consistent JSON payloads: { message, errors? }.
 */
class AppError extends Error {
  constructor(statusCode, message, errors = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = 'Invalid request', errors) {
    return new AppError(400, message, errors);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(401, message);
  }

  static forbidden(message = 'You are not allowed to do that') {
    return new AppError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(404, message);
  }

  static conflict(message = 'Resource already exists') {
    return new AppError(409, message);
  }

  static unprocessable(message = 'The submitted data could not be processed', errors) {
    return new AppError(422, message, errors);
  }

  static internal(message = 'Unexpected server error') {
    return new AppError(500, message);
  }
}

module.exports = AppError;
