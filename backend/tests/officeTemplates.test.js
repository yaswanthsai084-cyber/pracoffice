'use strict';

/**
 * Tests for `services/officeTemplates.js`.
 *
 * The blank documents it writes are handed to the ONLYOFFICE document server
 * as the student's starting file, so they must be real OOXML packages: the
 * test therefore round-trips each one through `utils/zip.js`, the reader the
 * evaluation engine uses. A template the platform cannot read itself would not
 * be safe to serve.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { blankDocx, blankXlsx, blankPptx, buildZip } = require('../services/officeTemplates');
const { readOfficeParts, readPartText } = require('../utils/zip');

/** Asserts a buffer is a readable archive containing the given parts. */
const assertReadable = (buffer, requiredParts) => {
  assert.ok(Buffer.isBuffer(buffer), 'a template must be a Buffer');
  assert.ok(buffer.length > 0, 'a template must not be empty');
  // Every ZIP archive starts with the "PK" local-header signature.
  assert.equal(buffer.subarray(0, 2).toString(), 'PK', 'a ZIP must start with PK');

  const parts = readOfficeParts(buffer);
  assert.ok(parts instanceof Map, 'the template must be readable by our own reader');

  for (const part of requiredParts) {
    assert.ok(parts.has(part), `missing required part: ${part}`);
    assert.ok(readPartText(parts, part).length > 0, `part is empty: ${part}`);
  }

  return parts;
};

test('blankDocx is a readable Word package with a document body', () => {
  const parts = assertReadable(blankDocx(), ['[Content_Types].xml', 'word/document.xml']);
  const xml = readPartText(parts, 'word/document.xml');

  assert.match(xml, /<w:document/);
  assert.match(xml, /<w:body/);
});

test('blankXlsx is a readable spreadsheet with one named sheet', () => {
  const parts = assertReadable(blankXlsx(), [
    '[Content_Types].xml',
    'xl/workbook.xml',
    'xl/worksheets/sheet1.xml',
  ]);

  assert.match(readPartText(parts, 'xl/workbook.xml'), /Sheet1/);
  // The worksheet must be referenced from the workbook relationships, or the
  // document server cannot find the sheet to open.
  assert.match(readPartText(parts, 'xl/_rels/workbook.xml.rels'), /worksheets\/sheet1\.xml/);
});

test('blankPptx is a readable presentation with one slide', () => {
  const parts = assertReadable(blankPptx(), [
    '[Content_Types].xml',
    'ppt/presentation.xml',
    'ppt/slides/slide1.xml',
  ]);

  assert.match(readPartText(parts, 'ppt/presentation.xml'), /sldIdLst/);
  assert.match(readPartText(parts, 'ppt/_rels/presentation.xml.rels'), /slides\/slide1\.xml/);
});

test('each template is a distinct shape, so a file type never gets the wrong file', () => {
  assert.equal(readOfficeParts(blankDocx()).has('word/document.xml'), true);
  assert.equal(readOfficeParts(blankXlsx()).has('word/document.xml'), false);
  assert.equal(readOfficeParts(blankPptx()).has('word/document.xml'), false);
});

test('templates are rebuilt each time, so callers cannot share a mutable buffer', () => {
  const first = blankDocx();
  const second = blankDocx();

  assert.notEqual(first, second, 'each call must return a fresh buffer');
  assert.deepEqual(first, second, 'but the contents must be identical');
});

test('buildZip writes an archive that zip.js can read back', () => {
  const parts = assertReadable(buildZip({ 'a/b.xml': '<b>hello</b>' }), ['a/b.xml']);
  assert.equal(readPartText(parts, 'a/b.xml'), '<b>hello</b>');
});
