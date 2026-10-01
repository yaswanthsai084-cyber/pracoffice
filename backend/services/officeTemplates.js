'use strict';

/**
 * Builds the blank .docx / .xlsx / .pptx the editor opens on.
 *
 * A student must be able to start the exam immediately, so the first open has
 * to hand the document server a real, valid Office file - not a placeholder.
 * Only the parts that make a file open cleanly are written: the content types,
 * the relationships and the single empty body the editor needs.
 *
 * `utils/zip.js` reads archives; this writes them, using the "stored" method so
 * no compressor is needed. The output is a genuine OOXML package that Word,
 * Excel, PowerPoint and ONLYOFFICE all accept.
 */

const zlib = require('zlib');

/**
 * Packs files into a ZIP archive.
 *
 * @param {Record<string,string>} files entry name -> text content
 * @returns {Buffer}
 */
const buildZip = (files) => {
  const locals = [];
  const centrals = [];
  const names = Object.keys(files);
  let offset = 0;

  for (const name of names) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const raw = Buffer.from(files[name], 'utf8');
    const crc = zlib.crc32 ? zlib.crc32(raw) : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(raw.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);

    locals.push(local, nameBuffer, raw);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10); // method: stored
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(raw.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);

    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + raw.length;
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

/** The [Content_Types].xml every OOXML package starts with. */
const contentTypes = (overrides) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  overrides +
  '</Types>';

/** The package-level relationships part. */
const rootRels = (target, type) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  `<Relationship Id="rId1" Type="${type}" Target="${target}"/>` +
  '</Relationships>';

/** A blank Word document with one empty paragraph. */
const blankDocx = () =>
  buildZip({
    '[Content_Types].xml': contentTypes(
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    ),
    '_rels/.rels': rootRels(
      'word/document.xml',
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
    ),
    'word/document.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p/></w:body></w:document>',
  });

/** A blank spreadsheet with one empty sheet. */
const blankXlsx = () =>
  buildZip({
    '[Content_Types].xml': contentTypes(
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    ),
    '_rels/.rels': rootRels(
      'xl/workbook.xml',
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
    ),
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '</Relationships>',
    'xl/worksheets/sheet1.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetData/></worksheet>',
  });

/** A blank presentation with one slide. */
const blankPptx = () =>
  buildZip({
    '[Content_Types].xml': contentTypes(
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
        '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
    ),
    '_rels/.rels': rootRels(
      'ppt/presentation.xml',
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
    ),
    'ppt/presentation.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>' +
      '</Relationships>',
    'ppt/slides/slide1.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:cSld><p:spTree/></p:cSld></p:sld>',
  });

module.exports = { buildZip, blankDocx, blankXlsx, blankPptx };

