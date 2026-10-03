'use strict';

/**
 * Builds the blank .docx / .xlsx / .pptx the editor opens on.
 *
 * A student must be able to start the exam immediately, so the first open has
 * to hand the document server a real, valid Office file - not a placeholder.
 * Only the parts that make a file open cleanly are written: the content types,
 * the relationships and the single empty body the editor needs.
 *
 * How much that is differs sharply by format. Word and Excel open from a
 * document part and a relationship to it, but a presentation is a chain - slide
 * to slide layout to slide master to theme - and the document server refuses
 * anything less. See `blankPptx` for the full explanation.
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

/** The XML declaration every OOXML part starts with. */
const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** The [Content_Types].xml every OOXML package starts with. */
const contentTypes = (overrides) =>
  DECLARATION +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  overrides +
  '</Types>';

/** The XML namespace shared by every `.rels` part. */
const RELATIONSHIPS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** The namespace every relationship *type* is built from. */
const OFFICE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** One `<Relationship>` entry. `type` is the full relationship-type URL. */
const relationship = (id, type, target) =>
  `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;

/**
 * A `.rels` part built from `[id, type, target]` rows.
 *
 * Writing the ids in one place per package is what keeps a reference from
 * pointing at the wrong part: a `<p:sldMasterId r:id="rId2">` is only correct as
 * long as `rId2` really is the slide master. A dangling or mismatched id makes
 * an otherwise complete file unopenable, which is worth avoiding by
 * construction rather than by proofreading.
 */
const relationships = (entries) =>
  DECLARATION +
  `<Relationships xmlns="${RELATIONSHIPS_NS}">` +
  entries.map(([id, type, target]) => relationship(id, type, target)).join('') +
  '</Relationships>';

/** The package-level relationships part, which points at the main document part. */
const rootRels = (target, type) => relationships([['rId1', type, target]]);

/** Relationship types used inside a presentation package. */
const PPT_REL = {
  officeDocument: `${OFFICE_RELATIONSHIPS}/officeDocument`,
  slide: `${OFFICE_RELATIONSHIPS}/slide`,
  slideLayout: `${OFFICE_RELATIONSHIPS}/slideLayout`,
  slideMaster: `${OFFICE_RELATIONSHIPS}/slideMaster`,
  theme: `${OFFICE_RELATIONSHIPS}/theme`,
};

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

/* ------------------------------------------------------------- presentation - */

const DRAWINGML_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PRESENTATIONML_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';

/** The three namespaces every PresentationML part declares. */
const PPT_NAMESPACES = ` xmlns:a="${DRAWINGML_NS}" xmlns:r="${OFFICE_RELATIONSHIPS}" xmlns:p="${PRESENTATIONML_NS}"`;

/**
 * The group-shape tree every PresentationML container starts with.
 *
 * It has to carry `nvGrpSpPr` and `grpSpPr`; an empty `<p:spTree/>` is not a
 * valid shape tree. The `a:xfrm` offsets are the ones PowerPoint itself writes.
 */
const PPT_SHAPE_TREE =
  '<p:spTree>' +
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
  '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
  '</p:spTree>';

/** Slide dimensions: 16:9, the size PowerPoint has defaulted to since 2013. */
const PPT_SLIDE_WIDTH = 12192000;
const PPT_SLIDE_HEIGHT = 6858000;

/**
 * The presentation theme.
 *
 * This is the part the earlier version of this file was missing, and it is the
 * one the document server actually needs: a slide resolves its colours and fonts
 * through its layout, the layout through the master, and the master through the
 * theme. Without a theme, ONLYOFFICE accepts the package and then fails with
 * "an error occurred while opening the file".
 *
 * `fmtScheme` is the verbose part. The schema requires at least three entries in
 * each of its four lists, which is why there are three identical fills, lines,
 * effects and background fills rather than the single one a blank slide seems to
 * need.
 */
const pptTheme = () => {
  const solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const line = (width) =>
    `<a:ln w="${width}" cap="flat" cmpd="sng" algn="ctr">${solid}<a:prstDash val="solid"/></a:ln>`;

  return (
    DECLARATION +
    `<a:theme xmlns:a="${DRAWINGML_NS}" name="Office Theme"><a:themeElements>` +
    // The twelve theme colours. dk1/lt1 use the system colours so the theme
    // follows the viewer's light/dark setting, as PowerPoint's own does.
    '<a:clrScheme name="Office">' +
    '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
    '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="4F81BD"/></a:accent1>' +
    '<a:accent2><a:srgbClr val="C0504D"/></a:accent2>' +
    '<a:accent3><a:srgbClr val="9BBB59"/></a:accent3>' +
    '<a:accent4><a:srgbClr val="8064A2"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="4BACC6"/></a:accent5>' +
    '<a:accent6><a:srgbClr val="F79646"/></a:accent6>' +
    '<a:hlink><a:srgbClr val="0000FF"/></a:hlink>' +
    '<a:folHlink><a:srgbClr val="800080"/></a:folHlink>' +
    '</a:clrScheme>' +
    '<a:fontScheme name="Office">' +
    '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
    '</a:fontScheme>' +
    '<a:fmtScheme name="Office">' +
    `<a:fillStyleLst>${solid}${solid}${solid}</a:fillStyleLst>` +
    `<a:lnStyleLst>${line(9525)}${line(25400)}${line(38100)}</a:lnStyleLst>` +
    '<a:effectStyleLst>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '</a:effectStyleLst>' +
    `<a:bgFillStyleLst>${solid}${solid}${solid}</a:bgFillStyleLst>` +
    '</a:fmtScheme>' +
    '</a:themeElements></a:theme>'
  );
};


/** A blank presentation with one slide. */
const blankPptx = () =>
  buildZip({
    '[Content_Types].xml': contentTypes(
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
        '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' +
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
    ),

    '_rels/.rels': rootRels('ppt/presentation.xml', PPT_REL.officeDocument),

    'ppt/presentation.xml':
      DECLARATION +
      `<p:presentation${PPT_NAMESPACES}>` +
      // rId2 is the master and rId1 the slide, matching the rels part below.
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId2"/></p:sldMasterIdLst>' +
      '<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>' +
      `<p:sldSz cx="${PPT_SLIDE_WIDTH}" cy="${PPT_SLIDE_HEIGHT}" type="screen16x9"/>` +
      '<p:notesSz cx="6858000" cy="9144000"/>' +
      '</p:presentation>',

    'ppt/_rels/presentation.xml.rels': relationships([
      ['rId1', PPT_REL.slide, 'slides/slide1.xml'],
      ['rId2', PPT_REL.slideMaster, 'slideMasters/slideMaster1.xml'],
      ['rId3', PPT_REL.theme, 'theme/theme1.xml'],
    ]),

    'ppt/slides/slide1.xml':
      DECLARATION +
      `<p:sld${PPT_NAMESPACES}><p:cSld>${PPT_SHAPE_TREE}</p:cSld>` +
      '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',

    // A slide with no layout relationship is invalid, and the colours it
    // inherits from the master cannot be resolved without one.
    'ppt/slides/_rels/slide1.xml.rels': relationships([
      ['rId1', PPT_REL.slideLayout, '../slideLayouts/slideLayout1.xml'],
    ]),

    'ppt/slideLayouts/slideLayout1.xml':
      DECLARATION +
      `<p:sldLayout${PPT_NAMESPACES} type="blank" preserve="1">` +
      `<p:cSld name="Blank">${PPT_SHAPE_TREE}</p:cSld>` +
      '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>',

    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': relationships([
      ['rId1', PPT_REL.slideMaster, '../slideMasters/slideMaster1.xml'],
      ['rId2', PPT_REL.theme, '../theme/theme1.xml'],
    ]),

    'ppt/slideMasters/slideMaster1.xml':
      DECLARATION +
      `<p:sldMaster${PPT_NAMESPACES}><p:cSld>${PPT_SHAPE_TREE}</p:cSld>` +
      // The colour map every slide inherits; these values are PowerPoint's own.
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" ' +
      'accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" ' +
      'accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
      '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
      '</p:sldMaster>',

    'ppt/slideMasters/_rels/slideMaster1.xml.rels': relationships([
      ['rId1', PPT_REL.slideLayout, '../slideLayouts/slideLayout1.xml'],
      ['rId2', PPT_REL.theme, '../theme/theme1.xml'],
    ]),

    'ppt/theme/theme1.xml': pptTheme(),
  });

module.exports = { buildZip, blankDocx, blankXlsx, blankPptx };

