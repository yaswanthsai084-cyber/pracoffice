'use strict';

/**
 * ONLYOFFICE Docs endpoints (see routes/officeRoutes.js for the auth model).
 *
 *   GET  /api/office/status          is the integration switched on?
 *   GET  /api/office/config/:partId  the signed editor config for a part
 *   GET  /api/office/file            the source file, fetched by the doc server
 *   POST /api/office/callback        the saved file, posted by the doc server
 */

const config = require('../config/env');
const officeService = require('../services/onlyofficeService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/apiError');

/**
 * ONLYOFFICE callback status codes (from the document server's own docs).
 * Only 2 and 6 mean "there is a newer version of this document to download".
 */
const CALLBACK_STATUS = {
  EDITING: 1, // a user is editing; nothing to save
  SAVE: 2, // the document is ready to be saved
  SAVE_ERROR: 3, // the document server could not save
  CLOSED_NO_CHANGES: 4, // everyone left without editing
  FORCE_SAVE: 6, // a forced save (the `forcesave` option)
  FORCE_SAVE_ERROR: 7, // a forced save failed
};

/** The statuses that carry a downloadable copy of the document. */
const SAVED_STATUSES = new Set([CALLBACK_STATUS.SAVE, CALLBACK_STATUS.FORCE_SAVE]);

/** The MIME type ONLYOFFICE expects for each stored file. */
const FILE_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** Reads `userId` and `part` from the query, rejecting anything implausible. */
const readTarget = (req) => {
  const userId = Number.parseInt(req.query.userId, 10);
  const part = String(req.query.part || '').toLowerCase();

  if (!Number.isInteger(userId) || userId < 1) {
    throw AppError.badRequest('A valid userId is required.');
  }

  if (!officeService.isEditablePart(part)) {
    throw AppError.badRequest(`"${part}" is not an editable part.`);
  }

  return { userId, part };
};

/** GET /api/office/status - lets the frontend decide whether to load the editor. */
const getStatus = asyncHandler(async (req, res) => {
  res.status(200).json({
    enabled: officeService.isEnabled(),
    parts: officeService.EDITABLE_PARTS,
    // The browser needs this to load ONLYOFFICE's own api.js.
    apiUrl: `${config.office.publicUrl}/web-apps/apps/api/documents/api.js`,
  });
});

/**
 * GET /api/office/config/:partId - the signed `DocsAPI.DocEditor` config.
 *
 * Returns `available: false` rather than an error when the integration is
 * switched off, so the exam page can fall back to its built-in editor without
 * treating the fallback as a failure.
 */
const getConfig = asyncHandler(async (req, res) => {
  const { partId } = req.params;

  if (!officeService.isEnabled()) {
    return res.status(200).json({ available: false, reason: 'disabled' });
  }

  if (!officeService.isEditablePart(partId)) {
    throw AppError.notFound(`No editor for part "${partId}".`);
  }

  const editorConfig = await officeService.buildEditorConfig(req.user.id, partId, req.user);

  if (!editorConfig) {
    return res.status(200).json({ available: false, reason: 'unavailable' });
  }

  res.status(200).json({
    available: true,
    partId: String(partId).toLowerCase(),
    apiUrl: `${config.office.publicUrl}/web-apps/apps/api/documents/api.js`,
    config: editorConfig,
  });
});

/**
 * GET /api/office/file - the document the editor opens.
 *
 * The document server fetches this itself; it is not meant to be loaded in a
 * browser, so it is served as an attachment with the correct MIME type.
 */
const getSourceFile = asyncHandler(async (req, res) => {
  const { userId, part } = readTarget(req);
  const document = await officeService.ensureDocument(userId, part);

  if (!document) {
    throw AppError.notFound('The document could not be prepared.');
  }

  const fileType = officeService.PART_TYPES[part].fileType;

  res.setHeader('Content-Type', FILE_TYPES[fileType]);
  res.setHeader('Content-Length', String(document.buffer.length));
  res.setHeader('Content-Disposition', `attachment; filename="document.${fileType}"`);
  res.status(200).send(document.buffer);
});

/**
 * POST /api/office/callback - the document server posts back the edited file.
 *
 * The body is `{ key, status, url, token }`. Only the statuses that carry a new
 * version are downloaded; the rest are acknowledged without a download. The
 * reply must be `{ "error": 0 }` on success, because anything else makes the
 * document server retry - which is the right behaviour when a save failed, since
 * losing a save would lose a student's work.
 */
const handleCallback = asyncHandler(async (req, res) => {
  const { userId, part } = readTarget(req);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const status = Number(body.status);

  if (!Number.isFinite(status)) {
    throw AppError.badRequest('The callback did not include a status.');
  }

  if (SAVED_STATUSES.has(status) && body.url) {
    try {
      const saved = await officeService.downloadFromUrl(body.url);
      await officeService.saveDocument(userId, part, saved);
      console.log(`[office] saved ${part} for user ${userId} (status ${status})`);
    } catch (error) {
      console.error(`[office] could not save ${part} for user ${userId}:`, error.message);
      return res.status(200).json({ error: 1, message: error.message });
    }
  }

  // { error: 0 } tells the document server the callback was handled.
  res.status(200).json({ error: 0 });
});

module.exports = { getStatus, getConfig, getSourceFile, handleCallback, CALLBACK_STATUS };
