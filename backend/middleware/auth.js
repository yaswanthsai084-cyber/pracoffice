'use strict';

/**
 * JWT authentication middleware.
 * Reads `Authorization: Bearer <token>` and attaches the fresh user row to
 * `req.user`, so deleted/updated accounts are handled correctly.
 */

const authService = require('../services/authService');
const { User } = require('../models');
const AppError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');

const extractToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header === 'string' && /^Bearer\s+/i.test(header)) {
    return header.replace(/^Bearer\s+/i, '').trim();
  }
  if (typeof req.query?.token === 'string' && req.query.token.trim() !== '') {
    return req.query.token.trim();
  }
  return null;
};

const resolveUser = async (req) => {
  const token = extractToken(req);
  if (!token) throw AppError.unauthorized('Authentication required. Please log in.');

  const payload = authService.verifyToken(token);
  const user = await User.findByPk(payload.id);
  if (!user) throw AppError.unauthorized('This account no longer exists.');

  req.user = user;
  req.token = token;
  return user;
};

/** Requires a valid token; the request fails otherwise. */
const authenticate = asyncHandler(async (req, res, next) => {
  await resolveUser(req);
  next();
});

/** Attaches the user when a token is present, but never rejects. */
const optionalAuth = async (req, res, next) => {
  try {
    await resolveUser(req);
  } catch (error) {
    req.user = undefined;
  }
  next();
};

/** Restricts a route to a set of roles (reserved for future user roles). */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  const role = req.user.role || 'student';
  if (roles.length > 0 && !roles.includes(role)) return next(AppError.forbidden());
  return next();
};

module.exports = { authenticate, optionalAuth, requireRole, extractToken };
