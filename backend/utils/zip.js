'use strict';

/**
 * Minimal ZIP reader for Office Open XML files.
 *
 * A .docx / .xlsx / .pptx is a ZIP archive of XML parts, so the evaluation
 * engine has to open one and pull a part out. Node ships `zlib`, which is all a
 * ZIP needs to inflate a deflated entry, so this is implemented here rather than
 * pulling in a third-party archiver - the backend deliberately keeps its
 * dependency list small (see package.json).
 *
 * Only what OOXML uses is supported: the "stored" (0) and "deflate" (8)
 * compression methods. Anything else raises, because silently returning empty
 * bytes would make a grader mark correct work as wrong.
 */

const zlib = require('zlib');

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

const CENTRAL_HEADER_SIZE = 46;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;

/**
 * Finds the End Of Central Directory record, the only record that points back
 * at the central directory.
 *
 * It sits at the very end of the file unless an archive comment is present, so
 * the signature is searched backwards through the allowed comment window.
 * Scanning from the end also means a part whose *content* contains the EOCD
 * signature cannot fool the reader.
 */
const findEndOfCentralDirectory = (buffer) => {
  const earliest = Math.max(0, buffer.length - EOCD_MIN_SIZE - MAX_COMMENT_SIZE);

  for (let offset = buffer.length - EOCD_MIN_SIZE; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }

  return -1;
};

/**
 * Reads the central directory: the authoritative list of entries.
 *
 * The central directory is used rather than scanning local headers because it
 * carries the compressed size, so the reader never has to trust the (frequently
 * zeroed) sizes in the local file header.
 */
const readCentralDirectory = (buffer, eocdOffset) => {
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const directoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  // ZIP64 archives keep the real values in a separate record. No Office file
  // this project opens reaches that size, so it is rejected loudly rather than
  // read with a truncated 32-bit count.
  if (directoryOffset === 0xffffffff || entryCount === 0xffff) {
    const locatorOffset = eocdOffset - 20;

    if (
      locatorOffset < 0 ||
      buffer.readUInt32LE(locatorOffset) !== ZIP64_EOCD_LOCATOR_SIGNATURE
    ) {
      throw new Error('ZIP64 archives are not supported.');
    }
  }

  const entries = new Map();
  let cursor = directoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + CENTRAL_HEADER_SIZE > buffer.length) break;
    if (buffer.readUInt32LE(cursor) !== CENTRAL_HEADER_SIGNATURE) break;

    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraFieldLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const nameStart = cursor + CENTRAL_HEADER_SIZE;
    const name = buffer.toString('utf8', nameStart, nameStart + fileNameLength);

    entries.set(name, {
      name,
      compressionMethod: buffer.readUInt16LE(cursor + 10),
      compressedSize: buffer.readUInt32LE(cursor + 20),
      localHeaderOffset: buffer.readUInt32LE(cursor + 42),
    });

    cursor = nameStart + fileNameLength + extraFieldLength + commentLength;
  }

  return entries;
};

/** Inflates (or copies) one entry's bytes using its local header offset. */
const readEntryData = (buffer, entry) => {
  const headerOffset = entry.localHeaderOffset;

  if (buffer.readUInt32LE(headerOffset) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error(`Corrupt ZIP entry "${entry.name}".`);
  }

  // The local header repeats the name and extra-field lengths, and its extra
  // field may differ in length from the central directory's copy, so the data
  // offset has to be measured from the local header rather than reused.
  const fileNameLength = buffer.readUInt16LE(headerOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(headerOffset + 28);
  const dataStart = headerOffset + 30 + fileNameLength + extraFieldLength;
  const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === METHOD_STORED) return Buffer.from(raw);
  if (entry.compressionMethod === METHOD_DEFLATE) return zlib.inflateRawSync(raw);

  throw new Error(
    `Unsupported ZIP compression method ${entry.compressionMethod} in "${entry.name}".`
  );
};

/**
 * Opens a ZIP archive.
 *
 * @param {Buffer} buffer raw .docx / .xlsx / .pptx bytes
 * @returns {Map<string, Buffer>} entry name -> decompressed contents
 */
const readZipEntries = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < EOCD_MIN_SIZE) {
    throw new Error('Not a readable ZIP archive (file too short).');
  }

  const eocdOffset = findEndOfCentralDirectory(buffer);

  if (eocdOffset === -1) {
    throw new Error('Not a readable ZIP archive (no central directory).');
  }

  const entries = readCentralDirectory(buffer, eocdOffset);
  const contents = new Map();

  for (const [name, entry] of entries) {
    // Directory markers carry no payload.
    if (name.endsWith('/')) continue;
    contents.set(name, readEntryData(buffer, entry));
  }

  return contents;
};

/**
 * Opens an Office document, treating an unreadable file as "no work submitted".
 *
 * A malformed or truncated upload must never fail an exam submit, so parse
 * problems resolve to null and the caller reports those tasks as unattempted.
 *
 * @param {Buffer} buffer raw document bytes
 * @returns {Map<string, Buffer>|null}
 */
const readOfficeParts = (buffer) => {
  try {
    return readZipEntries(buffer);
  } catch {
    return null;
  }
};

/** Reads one part as UTF-8 text, or null when the part is absent. */
const readPartText = (parts, name) => {
  if (!parts) return null;
  const entry = parts.get(name);
  return entry ? entry.toString('utf8') : null;
};

module.exports = { readZipEntries, readOfficeParts, readPartText };
