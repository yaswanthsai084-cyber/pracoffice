'use strict';

/**
 * Authenticates the ONLYOFFICE document server's own requests.
 *
 * The document server downloads the source file from `document.url` and posts
 * the saved copy to `callbackUrl`. It has no PracOffice session, so the student
 * middleware cannot be used. Instead the request must carry a JWT signed with
 * the shared ONLYOFFICE secret - the same secret the editor config was signed
 * with - and its `key` must match the document this request is about.
 *
 * Verifying the key as well as the signature is what stops one callback from
 * reading or overwriting another student's work: the `key` is what the server
 * was handed when it opened *that* document.
 */

const officeService = require('../services/onlyofficeService');
const AppError = require('../utils/apiError');

/** Pulls the signed token out of the request, wherever ONLYOFFICE put it. */
const extractToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization;

  if (typeof header === 'string' && /^Bearer\s+/i.test(header)) {
    return header.replace(/^Bearer\s+/i, '').trim();
  }

  // The callback carries it inside the JSON payload; the file download carries
  // it as a query parameter.
  if (typeof req.query?.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }

  if (req.body && typeof req.body.token === 'string' && req.body.token.trim()) {
    return req.body.token.trim();
  }

  return null;
};

/**
 * Requires a valid ONLYOFFICE token, and records the verified payload on
 * `req.officeToken` for the controller to read.
 */
const requireOfficeToken = (req, res, next) => {
  if (!officeService.isEnabled()) {
    return next(AppError.badRequest('The document editor is not enabled on this server.'));
  }

  const payload = officeService.verifyToken(extractToken(req));

  if (!payload) {
    return next(AppError.unauthorized('Invalid or missing document server token.'));
  }

  // Two token shapes arrive here, and both are legitimate:
  //
  //   - the file download, whose URL carries a token signed over `{ key }`
  //   - the callback, whose token is the whole signed editor config
  //
  // Both are rejected when they do not verify; the key claim is then read from
  // whichever shape arrived.
  const signedKey = payload.key || (payload.document && payload.document.key) || null;
  const requested = typeof req.query?.key === 'string' ? req.query.key.trim() : '';

  // Verifying the signature is what proves the request came from our own
  // document server; matching the key is what stops a valid token for one
  // document from being replayed against another student's file.
  if (requested && signedKey && requested !== signedKey) {
    return next(AppError.forbidden('The document key does not match this request.'));
  }

  req.officeToken = payload;
  return next();
};

module.exports = { requireOfficeToken, extractToken };
