'use strict';

/**
 * Tests for `services/onlyofficeService.js`.
 *
 * The document server itself is not needed: these cover everything the service
 * owns - the storage round trip, the `document.key` rules, token signing, and
 * the shape of the editor config that the browser hands to `DocsAPI.DocEditor`.
 *
 * The service reads `config.office`, so the tests point it at a throw-away
 * directory and switch it on directly rather than through process.env, which
 * would arrive too late once the module is already loaded.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const officeConfig = require('../config/env').office;
const office = require('../services/onlyofficeService');
const { readOfficeParts, readPartText } = require('../utils/zip');

/** Points storage at a temp directory and switches the integration on. */
const useOffice = () => {
  const original = { enabled: officeConfig.enabled, storageDir: officeConfig.storageDir };
  officeConfig.enabled = true;
  officeConfig.storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pracoffice-office-'));

  return () => {
    officeConfig.enabled = original.enabled;
    officeConfig.storageDir = original.storageDir;
    fs.rmSync(officeConfig.storageDir, { recursive: true, force: true });
  };
};

test('the module exposes the surface the controller and routes need', () => {
  const expected = [
    'isEnabled',
    'isEditablePart',
    'signToken',
    'verifyToken',
    'documentKey',
    'filePath',
    'ensureDocument',
    'readDocument',
    'saveDocument',
    'buildEditorConfig',
    'downloadFromUrl',
  ];

  for (const name of expected) {
    assert.equal(typeof office[name], 'function', `expected ${name} to be a function`);
  }

  assert.deepEqual(office.EDITABLE_PARTS, ['word', 'excel', 'powerpoint']);
  assert.deepEqual(office.PART_TYPES.word, { documentType: 'word', fileType: 'docx' });
  assert.deepEqual(office.PART_TYPES.excel, { documentType: 'cell', fileType: 'xlsx' });
  assert.deepEqual(office.PART_TYPES.powerpoint, { documentType: 'slide', fileType: 'pptx' });
});

test('isEditablePart accepts the three editors and rejects everything else', () => {
  assert.equal(office.isEditablePart('word'), true);
  assert.equal(office.isEditablePart('excel'), true);
  assert.equal(office.isEditablePart('powerpoint'), true);
  // Case-insensitive, so the part id arrives safely from the route.
  assert.equal(office.isEditablePart('WORD'), true);
  // Access and Email have no editor.
  assert.equal(office.isEditablePart('access'), false);
  assert.equal(office.isEditablePart('email'), false);
  assert.equal(office.isEditablePart(''), false);
  assert.equal(office.isEditablePart(undefined), false);
});

test('documentKey satisfies ONLYOFFICE charset, is stable and changes with content', () => {
  const contents = Buffer.from('the document bytes');
  const key = office.documentKey(7, 'word', contents);

  // ONLYOFFICE allows 0-9 a-z A-Z and -._= only, max 128 chars.
  assert.match(key, /^[0-9A-Za-z._=-]+$/);
  assert.ok(key.length <= 128, 'key must be at most 128 characters');

  // An unchanged file must reuse its key, or the editor cache would thrash.
  assert.equal(office.documentKey(7, 'word', contents), key);
  // An edited file must get a new key, or a stale copy would be served.
  assert.equal(office.documentKey(7, 'word', Buffer.from('different bytes')) !== key, true);
  // And two students with identical files must never share a cache entry.
  assert.equal(office.documentKey(8, 'word', contents) !== key, true);
});

test('blankDocument returns the right type and null for anything unknown', () => {
  for (const [fileType, marker] of [
    ['docx', 'word/document.xml'],
    ['xlsx', 'xl/workbook.xml'],
    ['pptx', 'ppt/presentation.xml'],
  ]) {
    const buffer = office.blankDocument(fileType);
    assert.ok(buffer && buffer.length > 0, `${fileType} template should be built`);
    assert.ok(readOfficeParts(buffer).has(marker), `${fileType} missing ${marker}`);
  }

  assert.equal(office.blankDocument('doc'), null);
  assert.equal(office.blankDocument(null), null);
});

test('tokens round-trip and reject a wrong signature', () => {
  const token = office.signToken({ key: 'abc' });

  assert.equal(office.verifyToken(token).key, 'abc');
  assert.equal(office.verifyToken('not-a-jwt'), null);
  assert.equal(office.verifyToken(''), null);
  assert.equal(office.verifyToken(undefined), null);
});

test('storage round trip: create, read, overwrite, delete', async () => {
  const restore = useOffice();

  try {
    const userId = 42;

    // Nothing saved yet -> read returns null (no work submitted).
    assert.equal(await office.readDocument(userId, 'word'), null);

    // First open creates the blank document and reports that it did.
    const first = await office.ensureDocument(userId, 'word');
    assert.equal(first.created, true);
    assert.ok(first.buffer.length > 0);
    // Reading from disk returns a fresh buffer with the same bytes, so the
    // comparison must be by value; reference equality would always fail.
    assert.deepEqual(await office.readDocument(userId, 'word'), first.buffer);

    // A second open reuses the saved copy rather than resetting the student.
    const again = await office.ensureDocument(userId, 'word');
    assert.equal(again.created, false);
    assert.deepEqual(again.buffer, first.buffer);

    // Reading back from disk gives a distinct buffer holding the same bytes.
    assert.deepEqual(await office.readDocument(userId, 'word'), first.buffer);

    // The document server posts the edited file back.
    const edited = Buffer.from('the student edited this');
    assert.equal(await office.saveDocument(userId, 'word', edited), true);
    assert.deepEqual(await office.readDocument(userId, 'word'), edited);

    // Invalid saves are refused rather than blanking the student's work.
    assert.equal(await office.saveDocument(userId, 'word', Buffer.alloc(0)), false);
    assert.equal(await office.saveDocument(userId, 'word', 'not a buffer'), false);
    assert.deepEqual(await office.readDocument(userId, 'word'), edited);

    // Each part and each student is stored separately.
    assert.equal(await office.readDocument(userId, 'excel'), null);
    assert.equal(await office.readDocument(userId + 1, 'word'), null);

    // Resetting an attempt removes only that student's copy.
    assert.equal(await office.deleteDocument(userId, 'word'), true);
    assert.equal(await office.readDocument(userId, 'word'), null);
    assert.equal(await office.deleteDocument(userId, 'word'), false, 'already gone');
  } finally {
    restore();
  }
});

test('buildEditorConfig returns a signed config the document server can use', async () => {
  const restore = useOffice();

  try {
    const userId = 9;
    const editor = await office.buildEditorConfig(userId, 'word');

    assert.ok(editor, 'a config should be built');
    assert.equal(editor.documentType, 'word');
    assert.equal(editor.document.fileType, 'docx');
    assert.equal(editor.editorConfig.mode, 'edit');
    // Full editor chrome inside the page. The `embedded` platform type is meant
    // to be paired with an `editorConfig.embedded` section (docked toolbar,
    // save/share URLs); used bare, the frame renders a reduced UI.
    assert.equal(editor.type, 'desktop');

    // document.url and callbackUrl are what the DOCUMENT server fetches, so they
    // must be absolute and point back at this API.
    assert.match(editor.document.url, /^https?:\/\/.+\/api\/office\/file\?/);
    assert.match(editor.document.url, /userId=9/);
    assert.match(editor.document.url, /part=word/);
    assert.match(editor.editorConfig.callbackUrl, /^https?:\/\/.+\/api\/office\/callback\?/);
    assert.match(editor.editorConfig.callbackUrl, /key=/);

    // The student can edit, but cannot take the file out of the exam.
    assert.equal(editor.document.permissions.edit, true);
    assert.equal(editor.document.permissions.modifyFilter, true);
    assert.equal(editor.document.permissions.modifyContentControl, true);
    assert.equal(editor.document.permissions.fillForms, true);
    assert.equal(editor.document.permissions.download, false);
    assert.equal(editor.document.permissions.print, false);

    // The config is signed so the document server can reject a tampered one.
    assert.ok(editor.token, 'config must be signed');
    const verified = office.verifyToken(editor.token);
    assert.equal(verified.document.key, editor.document.key);

    // Opening the editor created the student's working file on disk.
    assert.equal(fs.existsSync(office.filePath(userId, 'word')), true);
  } finally {
    restore();
  }
});

test('buildEditorConfig gives each editable part its own document type', async () => {
  const restore = useOffice();

  try {
    const types = { word: 'word', excel: 'cell', powerpoint: 'slide' };

    for (const [part, documentType] of Object.entries(types)) {
      const editor = await office.buildEditorConfig(5, part);
      assert.equal(editor.documentType, documentType, part);
    }
  } finally {
    restore();
  }
});

test('buildEditorConfig returns null for a part with no editor', async () => {
  const restore = useOffice();

  try {
    assert.equal(await office.buildEditorConfig(5, 'access'), null);
    assert.equal(await office.buildEditorConfig(5, 'email'), null);
    assert.equal(await office.buildEditorConfig(5, 'nosuchpart'), null);
  } finally {
    restore();
  }
});

test('isEditablePart and buildEditorConfig stay closed when office is disabled', async () => {
  const original = officeConfig.enabled;
  officeConfig.enabled = false;

  try {
    assert.equal(office.isEnabled(), false);
    // Even when asked directly, a disabled integration must not hand back a
    // config: the frontend needs `available: false`, not an error.
    assert.equal(await office.buildEditorConfig(1, 'word'), null);
  } finally {
    officeConfig.enabled = original;
  }
});

