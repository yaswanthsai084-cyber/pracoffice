'use strict';

/**
 * Unit tests for the Office Open XML reading helpers.
 *
 * These cover `utils/zip.js` (the archive reader) and `utils/xml.js` (the
 * element scanner), which together let the evaluation engine read a saved
 * .docx / .xlsx / .pptx without any third-party dependency.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

const { readZipEntries, readOfficeParts, readPartText } = require('../utils/zip');
const xml = require('../utils/xml');

/**
 * Builds a ZIP archive in memory, so the reader is tested against real bytes
 * (a real local header, central directory and EOCD) rather than a mock.
 *
 * @param {Record<string,string>} files entry name -> text content
 * @param {boolean} deflate store compressed (true) or uncompressed (false)
 */
const buildZip = (files, deflate = true) => {
  const locals = [];
  const centrals = [];
  const names = Object.keys(files);
  let offset = 0;

  for (const name of names) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const raw = Buffer.from(files[name], 'utf8');
    const data = deflate ? zlib.deflateRawSync(raw) : raw;
    const method = deflate ? 8 : 0;
    const crc = zlib.crc32 ? zlib.crc32(raw) : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);

    locals.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);

    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }

  const centralBuffer = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(names.length, 8);
  eocd.writeUInt16LE(names.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuffer, eocd]);
};

test('readZipEntries decompresses every stored part', () => {
  const archive = buildZip({
    '[Content_Types].xml': '<Types/>',
    'word/document.xml': '<w:document>hello</w:document>',
    'word/styles.xml': '<w:styles>Arial</w:styles>',
  });

  const parts = readZipEntries(archive);

  assert.deepEqual([...parts.keys()].sort(), [
    '[Content_Types].xml',
    'word/document.xml',
    'word/styles.xml',
  ]);
  assert.equal(readPartText(parts, 'word/document.xml'), '<w:document>hello</w:document>');
  assert.equal(readPartText(parts, 'word/styles.xml'), '<w:styles>Arial</w:styles>');
});

test('readZipEntries reads uncompressed (stored) entries too', () => {
  const archive = buildZip({ 'word/document.xml': '<w:document/>' }, false);
  assert.equal(readPartText(readZipEntries(archive), 'word/document.xml'), '<w:document/>');
});

test('readZipEntries round-trips a large part through a real deflate stream', () => {
  const long = 'x'.repeat(50000);
  const content = `<w:document>${long}</w:document>`;
  assert.equal(
    readPartText(readZipEntries(buildZip({ 'word/document.xml': content })), 'word/document.xml'),
    content
  );
});

test('readPartText returns null for a part that is not in the archive', () => {
  const parts = readZipEntries(buildZip({ 'a.xml': '<a/>' }));
  assert.equal(readPartText(parts, 'missing.xml'), null);
});

test('readZipEntries raises on something that is not an archive', () => {
  assert.throws(() => readZipEntries(Buffer.from('definitely not a zip')), /ZIP archive/);
  assert.throws(() => readZipEntries(Buffer.alloc(0)), /ZIP archive/);
});

test('readOfficeParts degrades to null so a bad upload cannot fail an exam', () => {
  assert.equal(readOfficeParts(Buffer.from('not an office document')), null);
  assert.equal(readOfficeParts(Buffer.alloc(0)), null);
  assert.equal(readOfficeParts(undefined), null);
  assert.ok(readOfficeParts(buildZip({ 'word/document.xml': '<w:document/>' })) instanceof Map);
});

test('splitElements returns each element with its own inner XML', () => {
  const parts = xml.splitElements(
    '<w:body><w:p><w:t>one</w:t></w:p><w:p><w:t>two</w:t></w:p></w:body>',
    'w:p'
  );

  assert.equal(parts.length, 2);
  assert.equal(xml.readText(parts[0].inner), 'one');
  assert.equal(xml.readText(parts[1].inner), 'two');
});

test('splitElements does not confuse a prefixed sibling for the element', () => {
  // <w:pPr> starts with "<w:p" but is a different element.
  const parts = xml.splitElements(
    '<w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:t>body</w:t></w:p></w:body>',
    'w:p'
  );

  assert.equal(parts.length, 1);
  assert.equal(xml.readText(parts[0].inner), 'body');
});

test('splitElements tracks nesting of the same element name', () => {
  const parts = xml.splitElements('<w:p>outer<w:p>inner</w:p></w:p>', 'w:p');
  assert.equal(parts.length, 1);
  assert.equal(parts[0].inner, 'outer<w:p>inner</w:p>');
});

test('splitElements keeps self-closing elements with empty inner XML', () => {
  const parts = xml.splitElements('<w:body><w:p/></w:body>', 'w:p');
  assert.equal(parts.length, 1);
  assert.equal(parts[0].inner, '');
});

test('readText decodes entities and collapses whitespace', () => {
  assert.equal(xml.readText('<w:t>Studying &amp; learning &#65;</w:t>'), 'Studying & learning A');
  assert.equal(xml.readText('<w:p><w:t>a</w:t><w:t>b</w:t></w:p>'), 'a b');
  assert.equal(xml.readText(null), '');
});

test('readElementText reads bare text that is not inside a run', () => {
  // A spreadsheet value and a field instruction both store plain text.
  assert.equal(xml.readElementText('1'), '1');
  assert.equal(xml.readElementText(' MERGEFIELD GreetingLine '), 'MERGEFIELD GreetingLine');
  assert.equal(xml.readElementText('a &amp; b'), 'a & b');
  assert.equal(xml.readElementText(null), '');
});

test('attributeValues reads a namespaced attribute', () => {
  const part = '<w:pPr><w:jc w:val="center"/><w:ind w:firstLine="720"/></w:pPr>';
  assert.deepEqual(xml.attributeValues(part, 'w:val'), ['center']);
  assert.deepEqual(xml.attributeValues(part, 'w:firstLine'), ['720']);
  assert.deepEqual(xml.attributeValues(null, 'w:val'), []);
});

test('attributeOf reads from the opening tag, which is where attributes live', () => {
  const [sheet] = xml.splitElements(
    '<sheets><sheet name="Electricity" sheetId="1" r:id="rId1"/></sheets>',
    'x:sheet'
  );

  // A self-closing element has no inner XML at all, so attributes must be
  // read from its opening tag.
  assert.equal(sheet.inner, '');
  assert.equal(xml.attributeOf(sheet, 'name'), 'Electricity');
  assert.equal(xml.attributeOf(sheet, 'r:id'), 'rId1');
  assert.equal(xml.attributeOf(undefined, 'name'), undefined);
});

test('hasElement detects run and table properties', () => {
  const run = '<w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr></w:r>';
  assert.equal(xml.hasElement(run, 'b'), true);
  assert.equal(xml.hasElement(run, 'i'), false);
  assert.equal(xml.hasElement('<w:tbl><w:tr/></w:tbl>', 'tbl'), true);
});

test('escapeXml makes a value safe to embed', () => {
  assert.equal(xml.escapeXml('a<b>&"c"'), 'a&lt;b&gt;&amp;&quot;c&quot;');
});

test('toNumber converts only real numbers', () => {
  assert.equal(xml.toNumber('24'), 24);
  assert.equal(xml.toNumber(''), null);
  assert.equal(xml.toNumber('abc'), null);
  assert.equal(xml.toNumber(null), null);
});

module.exports = { buildZip };

module.exports = { buildZip };
