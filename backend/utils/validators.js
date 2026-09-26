'use strict';

/**
 * Small dependency-free validation helpers used by the validation middleware.
 *
 * A rule is `{ name, test(value, body), message }`. Fields carrying the
 * `optional()` marker are skipped when the value is empty.
 */

const AppError = require('./apiError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Mobile numbers are 10-15 digits after separators are stripped.
const MOBILE_REGEX = /^\d{10,15}$/;
const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,59}$/;

const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
const normalizeMobile = (value) => String(value ?? '').replace(/[\s()+\-.]/g, '');
const normalizeName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeUsername = (value) => String(value ?? '').trim().toLowerCase();

/** Builds a readable, unique-safe username base from an email address. */
const suggestUsername = (email) => {
  const localPart = normalizeEmail(email).split('@')[0] || 'student';
  const cleaned = localPart
    .normalize('NFKD')
    .replace(/[^a-z0-9._-]+/gi, '')
    .replace(/^[^a-z0-9]+/i, '')
    .toLowerCase();
  const base = cleaned.length >= 3 ? cleaned : `student${cleaned}`;
  return base.slice(0, 60);
};

const rule = (name, test, message) => ({ name, test, message });

const required = (message = 'This field is required') =>
  rule('required', (value) => !isEmpty(value), message);

const optional = () => rule('optional', () => true, '');

const isEmail = (message = 'Enter a valid email address') =>
  rule('isEmail', (value) => EMAIL_REGEX.test(normalizeEmail(value)), message);

const isMobile = (message = 'Enter a valid mobile number (10 to 15 digits)') =>
  rule('isMobile', (value) => MOBILE_REGEX.test(normalizeMobile(value)), message);

const isDate = (message = 'Enter a valid date (YYYY-MM-DD)') =>
  rule('isDate', (value) => {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return false;
    const date = new Date(parsed);
    const year = date.getFullYear();
    if (year < 1900) return false;
    return parsed <= Date.now();
  }, message);

const minLength = (length, message = `Must be at least ${length} characters`) =>
  rule('minLength', (value) => String(value ?? '').trim().length >= length, message);

const maxLength = (length, message = `Must be at most ${length} characters`) =>
  rule('maxLength', (value) => String(value ?? '').trim().length <= length, message);

const matches = (regex, message = 'Value has an invalid format') =>
  rule('matches', (value) => regex.test(String(value ?? '').trim()), message);

const isUsername = (message = 'Username must be 3-60 characters: letters, numbers, dot, dash or underscore') =>
  rule('isUsername', (value) => USERNAME_REGEX.test(normalizeUsername(value)), message);

const isInteger = (message = 'Must be a whole number') =>
  rule('isInteger', (value) => Number.isInteger(Number(value)), message);

const oneOf = (values, message = `Must be one of: ${values.join(', ')}`) =>
  rule('oneOf', (value) => values.includes(value), message);

const custom = (test, message) => rule('custom', test, message);

/**
 * Express middleware factory. `schema` maps a body field to an array of rules:
 *
 *   validateBody({ email: [required(), isEmail()], username: [optional(), isUsername()] })
 */
const validateBody = (schema) => (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const errors = [];

  for (const [field, fieldRules] of Object.entries(schema)) {
    const value = body[field];
    const fieldIsOptional = fieldRules.some((item) => item.name === 'optional');

    if (fieldIsOptional && isEmpty(value)) continue;

    for (const item of fieldRules) {
      if (item.name === 'optional') continue;
      if (!item.test(value, body)) {
        errors.push({ field, message: item.message });
        break;
      }
    }
  }

  if (errors.length > 0) {
    return next(AppError.badRequest('Validation failed', errors));
  }

  return next();
};

module.exports = {
  EMAIL_REGEX,
  MOBILE_REGEX,
  USERNAME_REGEX,
  isEmpty,
  normalizeEmail,
  normalizeMobile,
  normalizeName,
  normalizeUsername,
  suggestUsername,
  required,
  optional,
  isEmail,
  isMobile,
  isDate,
  minLength,
  maxLength,
  matches,
  isUsername,
  isInteger,
  oneOf,
  custom,
  validateBody,
};
