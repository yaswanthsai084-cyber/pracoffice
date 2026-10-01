'use strict';

/**
 * ONLYOFFICE Docs integration: editor configuration, token signing and the
 * on-disk store of each student's working copy.
 *
 * ## How the round trip works
 *
 *   1. The browser asks this API for an editor config      (GET  /api/office/config/:partId)
 *   2. The browser hands that config to DocsAPI.DocEditor
 *   3. The document server DOWNLOADS the blank file        (GET  /api/office/file?...)
 *   4. The student works in the real editor
 *   5. The document server POSTS the saved copy back       (POST /api/office/callback?...)
 *   6. On submit, the saved file is graded from disk       (services/documentEvaluation.js)
 *
 * Steps 3 and 5 are server-to-server calls that carry ONLYOFFICE's own JWT, not
 * a student's token - the document server has no session. That is why those two
 * routes are authenticated by a signed token instead of `authenticate`.
 *
 * ## The `document.key` rule
 *
 * ONLYOFFICE caches an edited document against its `key`, so the key must be
 * regenerated whenever the document changes. A key derived from the file's
 * content hash does exactly that: the same saved file reuses its key (the cache
 * hit is correct), and a changed file gets a new one (the editor reloads the
 * real bytes instead of a stale cached copy).
 */

const crypto = require('crypto');
const fsp = require('fs/promises');
const path = require('path');
const jwt = require('jsonwebtoken');

const config = require('../config/env');
const templates = require('./officeTemplates');

/** Exam part id -> ONLYOFFICE document type and file type. */
const PART_TYPES = {
  word: { documentType: 'word', fileType: 'docx' },
  excel: { documentType: 'cell', fileType: 'xlsx' },
  powerpoint: { documentType: 'slide', fileType: 'pptx' },
};

/** The parts this integration can edit. */
const EDITABLE_PARTS = Object.keys(PART_TYPES);

/** Human-readable titles, used as the editor window title. */
const PART_TITLES = {
  word: 'Part A - Word',
  excel: 'Part B - Excel',
  powerpoint: 'Part C - PowerPoint',
};

/** True when the integration is switched on. */
const isEnabled = () => config.office.enabled === true;

/** True when `partId` maps to a real editor. */
const isEditablePart = (partId) => EDITABLE_PARTS.includes(String(partId || '').toLowerCase());

/* ---------------------------------------------------------------- tokens -- */

/**
 * Signs a payload with the shared ONLYOFFICE secret (HS256).
 *
 * The document server verifies this with the same secret, so it must never be
 * empty: a wrongly-signed config is rejected outright.
 */
const signToken = (payload) => jwt.sign(payload, config.office.jwtSecret, { algorithm: 'HS256' });

/**
 * Verifies a token posted by the document server.
 *
 * @returns {object|null} the payload, or null when the token is missing, invalid
 *                         or expired - the caller turns that into a 401.
 */
const verifyToken = (token) => {
  if (!token || !config.office.jwtEnabled) return null;
  try {
    return jwt.verify(token, config.office.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
};

/** Adds `token` to a config only when JWT is switched on. */
const withToken = (editorConfig) =>
  config.office.jwtEnabled
    ? { ...editorConfig, token: signToken(editorConfig) }
    : editorConfig;

/* --------------------------------------------------------------- storage -- */

/**
 * The directory holding one student's copy of one part.
 *
 * The user id keeps students isolated on disk, and the part id keeps the three
 * editors apart.
 */
const partDirectory = (userId, partId) =>
  path.join(config.office.storageDir, String(userId), String(partId).toLowerCase());

/** The full path of a student's working file. */
const filePath = (userId, partId) =>
  path.join(
    partDirectory(userId, partId),
    `document.${PART_TYPES[String(partId).toLowerCase()].fileType}`
  );

/**
 * A content-addressed key for the document.
 *
 * ONLYOFFICE allows 0-9, a-z, A-Z and `-._=`, up to 128 characters, and the key
 * must change whenever the document does. Hashing the bytes gives both
 * properties: stable for an unchanged file, different as soon as it is edited.
 * The user id is mixed in so two students editing identical blank files never
 * share an editor cache entry.
 */
const documentKey = (userId, partId, contents) =>
  `p${userId}-${String(partId).toLowerCase()}-${crypto
    .createHash('sha256')
    .update(contents)
    .digest('hex')
    .slice(0, 32)}`;

/** A blank, valid document of the right type to open the editor on. */
const blankDocument = (fileType) => {
  // The builders are camel-cased (blankDocx) while the file type is lower case
  // (docx), so the lookup is a fixed map rather than an assembled name - a
  // "blank${fileType}" lookup would never match.
  const BUILDERS = {
    docx: templates.blankDocx,
    xlsx: templates.blankXlsx,
    pptx: templates.blankPptx,
  };

  const build = BUILDERS[String(fileType || '').toLowerCase()];
  return build ? build() : null;
};

/**
 * Returns the student's working file, creating a blank one on first open.
 *
 * @returns {Promise<{buffer:Buffer, path:string, created:boolean}|null>}
 */
const ensureDocument = async (userId, partId) => {
  const part = String(partId).toLowerCase();

  if (!isEditablePart(part)) return null;

  const target = filePath(userId, part);

  try {
    const existing = await fsp.readFile(target);
    return { buffer: existing, path: target, created: false };
  } catch {
    // No saved copy yet - fall through and create the blank document.
  }

  const buffer = blankDocument(PART_TYPES[part].fileType);

  if (!buffer) return null;

  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, buffer);

  return { buffer, path: target, created: true };
};

/** Reads a student's saved file, or null when nothing has been saved yet. */
const readDocument = async (userId, partId) => {
  if (!isEditablePart(partId)) return null;
  try {
    return await fsp.readFile(filePath(userId, partId));
  } catch {
    return null;
  }
};

/** Overwrites a student's file with the copy the document server sent back. */
const saveDocument = async (userId, partId, buffer) => {
  if (!isEditablePart(partId) || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false;
  }

  const target = filePath(userId, partId);
  await fsp.mkdir(path.dirname(target), { recursive: true });

  // Written to a temporary file and moved into place, so a crash mid-write can
  // never leave a half-saved document that would then be graded as the student's
  // work.
  const temporary = `${target}.part`;
  await fsp.writeFile(temporary, buffer);
  await fsp.rename(temporary, target);

  return true;
};

/** Removes a student's saved document (used when an attempt is reset). */
const deleteDocument = async (userId, partId) => {
  if (!isEditablePart(partId)) return false;
  try {
    await fsp.unlink(filePath(userId, partId));
    return true;
  } catch {
    return false;
  }
};


/* --------------------------------------------------------------- config -- */

/**
 * Builds the signed `DocsAPI.DocEditor` config for one part.
 *
 * `document.url` and `callbackUrl` deliberately use the INTERNAL base URL: the
 * document server is the one that fetches them, and inside Compose it reaches
 * this API by service name. A browser only ever sees the public URL, which is
 * returned separately as `apiUrl` for loading api.js.
 *
 * @param {number} userId the signed-in student
 * @param {string} partId 'word' | 'excel' | 'powerpoint'
 * @returns {Promise<object|null>} the editor config, or null when unavailable
 */
const buildEditorConfig = async (userId, partId) => {
  const part = String(partId).toLowerCase();
  const types = PART_TYPES[part];

  // Defence in depth: the controller reports `available: false` first, but a
  // disabled integration must never hand back a config from anywhere.
  if (!types || !isEnabled()) return null;

  const document = await ensureDocument(userId, part);

  if (!document) return null;

  const internalBase = config.office.internalUrl || config.office.publicUrl;
  const fileName = `document.${types.fileType}`;
  // Derived from the current bytes, so an edited file always produces a new key
  // and ONLYOFFICE never serves a stale cached copy.
  const key = documentKey(userId, part, document.buffer);
  // The document server does not add anything to `document.url`, so the token
  // protecting that download has to travel inside the URL itself. Signing just
  // the key (rather than the whole config) keeps the grant narrow: it can only
  // fetch this document, nothing else.
  const fileToken = config.office.jwtEnabled
    ? `&token=${encodeURIComponent(signToken({ key }))}`
    : '';

  const base = {
    documentType: types.documentType,
    // Embedded rather than a full-screen takeover: the student must still reach
    // the question panel and the submit button.
    type: 'embedded',
    width: '100%',
    height: '100%',
    title: `${PART_TITLES[part] || part} (${fileName})`,
    document: {
      fileType: types.fileType,
      key,
      title: fileName,
      url: `${internalBase}/api/office/file?userId=${userId}&part=${part}&key=${key}${fileToken}`,
      permissions: {
        edit: true,
        // Downloading and printing are off: this is a supervised test and the
        // submitted file is the only copy that counts.
        download: false,
        print: false,
        copy: true,
      },
    },
    editorConfig: {
      mode: 'edit',
      lang: 'en',
      callbackUrl: `${internalBase}/api/office/callback?userId=${userId}&part=${part}&key=${key}`,
      // Co-editing is pointless for a one-student exam and would let a second
      // connection open the same cached document.
      coEditing: { mode: 'strict', change: false },
      customization: {
        hideRightMenu: true,
        hideFileName: true,
        autosave: true,
        forcesave: true,
      },
    },
  };

  return withToken(base);
};

/**
 * Downloads a document from the URL the document server sent us.
 *
 * Used by the callback to fetch the edited file. Redirects are followed because
 * the document server issues a short-lived signed URL that redirects to storage.
 */
const downloadFromUrl = async (url) => {
  const response = await fetch(url, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`The document server answered ${response.status} for the saved file.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error('The document server returned an empty file.');
  }

  return buffer;
};

module.exports = {
  PART_TYPES,
  EDITABLE_PARTS,
  PART_TITLES,
  isEnabled,
  isEditablePart,
  signToken,
  verifyToken,
  documentKey,
  partDirectory,
  filePath,
  blankDocument,
  ensureDocument,
  readDocument,
  saveDocument,
  deleteDocument,
  buildEditorConfig,
  downloadFromUrl,
};

