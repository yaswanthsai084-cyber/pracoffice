'use strict';

/**
 * Validation middleware.
 *
 * - `aliasBody(map)` copies legacy field names onto the canonical ones before
 *   validation runs, e.g. `mobileno` -> `mobileNumber`, `dob` -> `dateOfBirth`.
 * - `validateBody(schema)` is re-exported from utils/validators for consistent
 *   import paths across routes.
 */

const { validateBody } = require('../utils/validators');

const hasValue = (value) => value !== undefined && value !== null && value !== '';

/**
 * Normalizes alias keys to canonical keys on req.body.
 * @param {Object<string, string[]>} aliases canonical key -> alternative keys
 *   checked (in order) when the canonical key is missing or empty.
 */
const aliasBody = (aliases) => (req, res, next) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};

  for (const [canonical, alternatives] of Object.entries(aliases)) {
    if (hasValue(body[canonical])) continue;
    for (const alias of alternatives) {
      if (hasValue(body[alias])) {
        body[canonical] = body[alias];
        break;
      }
    }
  }

  next();
};

module.exports = { validateBody, aliasBody };
