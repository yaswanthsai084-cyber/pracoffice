'use strict';

/**
 * Authentication service.
 *
 * Registration: username + email + mobile number + date of birth, exactly what
 * the frontend Registration page collects. The mobile number is the initial
 * password ("Password (user's mobile number)"), stored hashed with bcrypt.
 * A username is derived from the email unless the client sends one, and `name`
 * defaults to the username when it is not supplied.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op, UniqueConstraintError } = require('sequelize');

const config = require('../config/env');
const { User } = require('../models');
const AppError = require('../utils/apiError');
const {
  normalizeEmail,
  normalizeMobile,
  normalizeName,
  normalizeUsername,
  suggestUsername,
  USERNAME_REGEX,
} = require('../utils/validators');

/** Signs a JWT for the given user. */
const buildToken = (user) =>
  jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn, issuer: config.jwt.issuer }
  );

/** Verifies a JWT and returns its payload (throws AppError on failure). */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Your session has expired. Please log in again.');
    }
    throw AppError.unauthorized('Invalid authentication token.');
  }
};

/** Finds a free username by appending a counter when the base is taken. */
const resolveUsername = async (preferred, email) => {
  const requested = preferred ? normalizeUsername(preferred) : '';

  if (requested) {
    if (!USERNAME_REGEX.test(requested)) {
      throw AppError.badRequest('Validation failed', [
        { field: 'username', message: 'Username must be 3-60 characters (letters, numbers, . _ -)' },
      ]);
    }
    const taken = await User.count({ where: { username: requested } });
    if (taken > 0) throw AppError.conflict('That username is already taken');
    return requested;
  }

  const base = suggestUsername(email);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const taken = await User.count({ where: { username: candidate } });
    if (taken === 0) return candidate;
  }

  return `${base}${Date.now().toString().slice(-5)}`;
};

/**
 * Registers a user and returns a session.
 * @param {object} payload { username?, mobileNumber, email, dateOfBirth, name?, password? }
 *   (legacy aliases mobileno/mobile/dob are accepted too)
 */
const register = async (payload = {}) => {
  const email = normalizeEmail(payload.email);
  const mobile = normalizeMobile(
    payload.mobileNumber ?? payload.mobileno ?? payload.mobile ?? payload.phoneNumber
  );
  const dob = payload.dateOfBirth ?? payload.dob ?? payload.birthDate;
  const dobValue = dob ? String(dob).trim() : '';

  const missing = [];
  if (!email) missing.push({ field: 'email', message: 'Email is required' });
  if (!mobile) missing.push({ field: 'mobileNumber', message: 'Mobile number is required' });
  if (!dobValue) missing.push({ field: 'dateOfBirth', message: 'Date of birth is required' });
  if (missing.length > 0) throw AppError.badRequest('Validation failed', missing);

  const existing = await User.findOne({
    where: { [Op.or]: [{ email }, { mobile }] },
  });

  if (existing) {
    const clash = normalizeEmail(existing.email) === email ? 'email' : 'mobile number';
    throw AppError.conflict(`That ${clash} is already registered`);
  }

  const username = await resolveUsername(payload.username, email);
  const name = normalizeName(payload.name) || username;
  // PLAN.md: password starts as the mobile number unless one is supplied.
  const password = payload.password ? String(payload.password) : mobile;
  const hashedPassword = await bcrypt.hash(password, config.bcrypt.saltRounds);

  try {
    const user = await User.create({ name, email, mobile, dob: dobValue, username, password: hashedPassword });
    return {
      user: user.toPublicJSON(),
      token: buildToken(user),
      expiresIn: config.jwt.expiresIn,
    };
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw AppError.conflict('That email, mobile number or username is already registered');
    }
    throw error;
  }
};

/** Logs a user in with username (or email) + password (= mobile number). */
const login = async ({ username, email, password } = {}) => {
  const identifier = normalizeUsername(username ?? email);

  if (!identifier || !password) {
    throw AppError.badRequest('Username and password are required');
  }

  const user = await User.scope('withPassword').findOne({
    where: {
      [Op.or]: [{ username: identifier }, { email: normalizeEmail(username ?? email) }],
    },
  });

  // Same message for unknown user and wrong password (no account enumeration).
  const invalid = AppError.unauthorized('Username or password is incorrect');
  if (!user) throw invalid;

  const matches = await bcrypt.compare(String(password), user.password);
  if (!matches) throw invalid;

  return {
    user: user.toPublicJSON(),
    token: buildToken(user),
    expiresIn: config.jwt.expiresIn,
  };
};

/** Loads the signed-in user's profile. */
const getProfile = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw AppError.unauthorized('This account no longer exists');
  return user.toPublicJSON();
};

module.exports = { register, login, getProfile, verifyToken, buildToken, resolveUsername };
