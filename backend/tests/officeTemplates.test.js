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
    // A presentation is a chain: slide -> layout -> master -> theme. Without
    // all four the document server opens the package and then fails with
    // "an error occurred while opening the file".
    'ppt/slideLayouts/slideLayout1.xml',
    'ppt/slideMasters/slideMaster1.xml',
    'ppt/theme/theme1.xml',
  ]);

  assert.match(readPartText(parts, 'ppt/presentation.xml'), /sldIdLst/);
  assert.match(readPartText(parts, 'ppt/_rels/presentation.xml.rels'), /slides\/slide1\.xml/);
});

/**
 * Every reference in the presentation package must resolve.
 *
 * A dangling reference is invisible in the XML - the package lists fine - and
 * only appears as a document the editor refuses to open, so it is checked here
 * rather than discovered in the browser. An earlier version of this template
 * pointed `sldMasterId` at the theme's `rId`, which is exactly what this
 * catches.
 */
test('blankPptx references resolve: rels targets and rIds are all real', () => {
  const parts = readOfficeParts(blankPptx());
  assert.ok(parts, 'the presentation must be readable');

  // A relative Target is resolved against the folder of the part that owns the
  // rels file, then any "x/../" is collapsed.
  const resolveTarget = (base, target) => {
    const joined = target.startsWith('/')
      ? target.slice(1)
      : base
        ? `${base}/${target}`
        : target;
    return joined.replace(/[^/]+\/\.\.\//g, '');
  };

  /** `ppt/slides/_rels/slide1.xml.rels` -> `ppt/slides`; root `_rels/.rels` -> ''. */
  const baseOfRels = (relsName) => {
    const marker = relsName.indexOf('/_rels/');
    return marker === -1 ? '' : relsName.slice(0, marker);
  };

  const relsParts = [...parts.keys()].filter((name) => name.endsWith('.rels'));
  assert.ok(
    relsParts.length >= 5,
    `expected the slide, layout, master and presentation rels parts, found ${relsParts.length}`
  );

  // Direction 1: every declared Target names a part that is really in the ZIP.
  for (const relsName of relsParts) {
    const base = baseOfRels(relsName);

    for (const [, target] of readPartText(parts, relsName).matchAll(/Target="([^"]+)"/g)) {
      const resolved = resolveTarget(base, target);
      assert.ok(parts.has(resolved), `${relsName} targets missing part "${resolved}"`);
    }
  }

  // Direction 2: every r:id a part uses is declared in that part's own rels.
  const relsPathFor = (part) => {
    const slash = part.lastIndexOf('/');
    return `${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`;
  };

  let idsChecked = 0;

  for (const [name, contents] of parts) {
    if (name.endsWith('.rels') || !name.endsWith('.xml')) continue;

    const ids = [...contents.toString('utf8').matchAll(/r:id="([^"]+)"/g)].map((m) => m[1]);
    if (ids.length === 0) continue;

    const rels = readPartText(parts, relsPathFor(name));
    assert.ok(rels, `${name} uses rIds but ${relsPathFor(name)} is missing`);

    const declared = new Set([...rels.matchAll(/Id="([^"]+)"/g)].map((m) => m[1]));

    for (const id of ids) {
      assert.ok(declared.has(id), `${name} references ${id}, undeclared in ${relsPathFor(name)}`);
      idsChecked += 1;
    }
  }

  // Guard against the loop silently finding nothing to verify.
  assert.ok(idsChecked >= 3, `expected the cross-part references to be checked, saw ${idsChecked}`);

  // The spec requirement whose absence broke the template: a slide must name a
  // slide layout, which is what makes the master and theme reachable.
  assert.match(
    readPartText(parts, 'ppt/slides/_rels/slide1.xml.rels'),
    /slideLayouts\/slideLayout1\.xml/
  );
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
