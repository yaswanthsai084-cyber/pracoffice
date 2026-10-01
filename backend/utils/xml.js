'use strict';

/**
 * Small XML reading helpers for the Office Open XML evaluation engine.
 *
 * The graders need a handful of facts out of an OOXML part - the text of a run,
 * the value of an attribute, whether an element exists - so a tiny purpose-built
 * scanner is used instead of a full XML parser dependency. It is deliberately
 * forgiving: a document that is nearly correct must still be gradeable, and only
 * clear structural facts (does this run say Arial? is this cell bold?) are
 * checked, never the exact formatting of the file itself.
 *
 * Everything works on the raw part text, so no DOM has to be built.
 */

/** Strips the `w:` / `a:` / `x:` prefix OOXML uses for namespaces. */
const localName = (name) => String(name || '').replace(/^[\w-]+:/, '').toLowerCase();

/** Matches an opening, self-closing or closing tag and captures its name. */
const TAG_PATTERN = /<(\/?)([A-Za-z_][\w.:-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;

/** Every element name contained in a part, lower-cased and namespace-stripped. */
const listElements = (xml) => {
  if (!xml) return [];
  const names = [];
  let match;

  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(xml)) !== null) {
    if (match[1] === '/') continue; // closing tag
    names.push(localName(match[2]));
  }

  return names;
};

/** True when the part declares at least one of the given element names. */
const hasElement = (xml, ...names) => {
  const wanted = names.map((name) => localName(name));
  return listElements(xml).some((name) => wanted.includes(name));
};

/** The value of an attribute on every tag that carries it, e.g. `w:val`. */
const attributeValues = (xml, attribute) => {
  if (!xml) return [];
  const escaped = String(attribute).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}\\s*=\\s*"([^"]*)"`, 'g');
  const values = [];
  let match;

  while ((match = pattern.exec(xml)) !== null) values.push(match[1]);

  return values;
};

/**
 * Splits a part into the opening tag, inner XML and attributes of every
 * occurrence of an element, e.g. each `<w:p>` paragraph of a document.
 *
 * Nested occurrences of the same element are not descended into, which is what
 * callers want: the direct text of a paragraph must not include a nested
 * table's text.
 *
 * @returns {{ open: string, inner: string, attributes: string }[]}
 */
const splitElements = (xml, elementName) => {
  if (!xml) return [];
  // Compared namespace-stripped, so callers may pass "w:p" or just "p".
  const target = localName(elementName);
  const results = [];

  // One forward pass over every tag, tracking nesting depth of the target
  // element. A prefix match is not enough: <w:p> and <w:pPr> share a prefix,
  // so the name has to be compared in full.
  const walker = /<(\/?)([\w.:-]+)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;
  let match;
  let depth = 0;
  let start = -1;
  let startTag = '';
  let attributes = '';

  while ((match = walker.exec(xml)) !== null) {
    const isClosing = match[1] === '/';
    const name = localName(match[2]);
    const isSelfClosing = match[4] === '/';

    if (name !== target) continue;

    if (!isClosing) {
      if (depth === 0) {
        start = match.index;
        startTag = match[0];
        attributes = match[3] || '';
      }

      // A self-closing target has no inner XML, so it is emitted immediately.
      if (isSelfClosing && depth === 0) {
        results.push({ open: startTag, inner: '', attributes });
        start = -1;
      } else {
        depth += 1;
      }
      continue;
    }

    if (depth === 0) continue; // stray close tag
    depth -= 1;

    if (depth === 0 && start !== -1) {
      const inner = xml.slice(start + startTag.length, match.index);
      results.push({ open: startTag, inner, attributes });
      start = -1;
    }
  }

  return results;
};

/** Every `<w:t>` text run in a part, joined with spaces. */
const readText = (xml) => {
  if (!xml) return '';
  const runs = [];
  const pattern = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g;
  let match;

  while ((match = pattern.exec(xml)) !== null) {
    runs.push(decodeEntities(match[1]));
  }

  return runs.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * The direct text content of an element, used where the body is plain text
 * rather than a `<w:t>` run.
 *
 * `readText` deliberately reads only `<t>` runs so it never picks up a
 * neighbouring element's text, but a spreadsheet value cell holds its value as
 * bare text inside `<v>1</v>`, a shared string index likewise, and a Word field
 * instruction lives in `<w:instrText>`. The character data between the
 * element's own tags is exactly what those callers need.
 */
const readElementText = (inner) => {
  if (!inner) return '';
  return decodeEntities(String(inner).replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
};

/** Decodes the XML entities OOXML escapes inside text runs. */
const decodeEntities = (value) =>
  String(value == null ? '' : value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&');

/** Escapes a value for safe inclusion in generated XML. */
const escapeXml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * The attribute string of a split element.
 *
 * Attributes always live on the element's own opening tag, never in its inner
 * XML - and a self-closing element such as `<sheet name="x"/>` has no inner XML
 * at all. Callers therefore read attributes from here rather than from `inner`,
 * which is what keeps a self-closing sheet or cell readable.
 */
const elementAttributes = (element) => {
  if (!element) return '';
  return typeof element === 'string' ? element : `${element.open || ''}`;
};

/** The first value of an attribute on a split element's opening tag. */
const attributeOf = (element, attribute) =>
  attributeValues(elementAttributes(element), attribute)[0];

/** Numeric attribute as a Number, or null when absent / not numeric. */
const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

module.exports = {
  localName,
  listElements,
  hasElement,
  attributeValues,
  elementAttributes,
  attributeOf,
  splitElements,
  readText,
  readElementText,
  decodeEntities,
  escapeXml,
  toNumber,
};

