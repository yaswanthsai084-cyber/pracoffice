'use strict';

/**
 * Auth routes for the frontend Register / Login pages.
 *
 * The registration form (frontend/src/pages/Registration.jsx) submits:
 *   { username, mobileNumber, email, dateOfBirth }
 * and the login form (frontend/src/pages/Login.jsx) submits:
 *   { username, password }   (password = the registered mobile number)
 *
 * Legacy alias field names (mobileno / mobile / dob) are accepted as well so
 * older clients keep working.
 */

const express = require('express');

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateBody, aliasBody } = require('../middleware/validate');
const AppError = require('../utils/apiError');
const {
  required,
  optional,
  isEmail,
  isMobile,
  isDate,
  isUsername,
  minLength,
  maxLength,
} = require('../utils/validators');

const router = express.Router();

/** Require a username or an email on login. */
const requireIdentifier = (req, res, next) => {
  const { username, email } = req.body || {};
  if (!username && !email) {
    return next(
      AppError.badRequest('Validation failed', [
        { field: 'username', message: 'Enter your username or email' },
      ])
    );
  }
  return next();
};

// POST /api/auth/register - username + email + mobile + dob (password = mobile)
router.post(
  '/register',
  aliasBody({
    mobileNumber: ['mobileno', 'mobile', 'phoneNumber'],
    dateOfBirth: ['dob', 'birthDate'],
    email: ['emailAddress'],
  }),
  validateBody({
    username: [optional(), isUsername()],
    mobileNumber: [required('Mobile number is required'), isMobile()],
    email: [required('Email is required'), isEmail()],
    dateOfBirth: [required('Date of birth is required'), isDate()],
    name: [optional(), minLength(2), maxLength(120)],
    password: [optional(), minLength(6, 'Password must be at least 6 characters')],
  }),
  authController.register
);

// POST /api/auth/login - username (or email) + password (mobile number)
router.post(
  '/login',
  validateBody({
    password: [required('Password is required')],
    username: [optional()],
    email: [optional(), isEmail()],
  }),
  requireIdentifier,
  authController.login
);

// GET /api/auth/me - current profile
router.get('/me', authenticate, authController.me);

module.exports = router;
