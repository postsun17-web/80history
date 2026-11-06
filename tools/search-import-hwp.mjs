import {inflateRawSync} from 'node:zlib';
import {openCompoundFile} from './search-import-ole.mjs';
import {cleanText} from './search-import-text.mjs';

const PARAGRAPH_TEXT = 67;
const CONTROL_HEADER = 71;
const LIST_HEADER = 72;
const TABLE = 77;
const SECTION_NAME = /^BodyText\/Section(0|[1-9]\d*)$/u;
const PROTECTED = (1 << 1) | (1 << 2) | (1 << 4) | (1 << 8) | (1 << 10) | (1 << 13);

// Hancom HWP 5.0 rev. 1.3, table 6 and sections 4.3.2, 4.3.9.1.
function paragraphText(payload) {
  if (payload.length % 2 !== 0) throw new Error('Truncated HWP UTF-16 paragraph');
  const parts = [];
  let start = 0;
  for (let offset = 0; offset < payload.length;) {
    const code = payload.readUInt16LE(offset);
    if (code >= 32) {
      offset += 2;
      continue;
    }
    parts.push(payload.toString('utf16le', start, offset));
    const wide = (code >= 1 && code <= 9) || code === 11 || code === 12 || (code >= 14 && code <= 23);
    if (wide && (offset + 16 > payload.length || payload.readUInt16LE(offset + 14) !== code)) {
      throw new Error('Malformed HWP paragraph control');
    }
    if ([9, 10, 13, 30, 31].includes(code)) parts.push(' ');
    if (code === 24) parts.push('-');
    offset += wide ? 16 : 2;
    start = offset;
  }
  parts.push(payload.toString('utf16le', start));
  return cleanText(parts.join(''));
}

function readRecords(bytes) {
  const root = {level: -1, children: []};
  const parents = [root];
  for (let offset = 0; offset < bytes.length;) {
    if (offset + 4 > bytes.length) throw new Error('Truncated HWP record header');
    const header = bytes.readUInt32LE(offset);
    const tag = header & 0x3ff;
    const level = (header >>> 10) & 0x3ff;
    let size = header >>> 20;
    offset += 4;
    if (size === 4095) {
      if (offset + 4 > bytes.length) throw new Error('Truncated HWP extended record header');
      size = bytes.readUInt32LE(offset);
      offset += 4;
    }
    if (offset + size > bytes.length) throw new Error('Truncated HWP record payload');
    const node = {tag, level, payload: bytes.subarray(offset, offset + size), children: []};
    while (parents.at(-1).level >= level) parents.pop();
    parents.at(-1).children.push(node);
    parents.push(node);
    offset += size;
  }
  return root.children;
}

function extractionAudit() {
  return {omittedHeaderFooterControls: 0, tablesWithCellCoordinates: 0, tablesWithSerializedOrder: 0};
}

export function extractHwpSection(bytes, audit = extractionAudit()) {
  const paragraphs = [];

  function visitTable(records) {
    const definition = records.findIndex(({tag}) => tag === TABLE);
    if (definition === -1) {
      audit.tablesWithSerializedOrder++;
      visit(records);
      return;
    }
    const {payload} = records[definition];
    if (payload.length < 8) throw new Error('Truncated HWP table definition');
    const rows = payload.readUInt16LE(4);
    const columns = payload.readUInt16LE(6);
    let cells = [];
    const outsideCells = records.slice(0, definition + 1);
    for (const record of records.slice(definition + 1)) {
      if (record.tag === LIST_HEADER && record.payload.length >= 32) {
        cells.push({records: [record]});
      } else {
        (cells.at(-1)?.records ?? outsideCells).push(record);
      }
    }
    // Hancom documents a six-byte list header. Some HWP writers serialize an
    // extra UINT16 before the list flags. Accept only a consistent table layout.
    function readCoordinates(offset) {
      const seen = new Set();
      const positioned = [];
      for (const cell of cells) {
        const {payload} = cell.records[0];
        if (payload.length < offset + 26) return undefined;
        const column = payload.readUInt16LE(offset);
        const row = payload.readUInt16LE(offset + 2);
        const width = payload.readUInt16LE(offset + 4);
        const height = payload.readUInt16LE(offset + 6);
        const key = `${row}:${column}`;
        if (width === 0 || height === 0 || column + width > columns || row + height > rows || seen.has(key)) {
          return undefined;
        }
        seen.add(key);
        positioned.push({...cell, row, column});
      }
      return positioned.length > 0 ? positioned : undefined;
    }
    const positioned = readCoordinates(6) ?? readCoordinates(8);
    if (positioned) {
      cells = positioned;
      cells.sort((a, b) => a.row - b.row || a.column - b.column);
      audit.tablesWithCellCoordinates++;
    } else {
      audit.tablesWithSerializedOrder++;
    }
    visit(outsideCells);
    for (const cell of cells) visit(cell.records);
  }

  function visit(records) {
    for (const {tag, payload, children} of records) {
      if (tag === PARAGRAPH_TEXT) {
        const text = paragraphText(payload);
        if (text) paragraphs.push(text);
      }
      if (tag === CONTROL_HEADER) {
        if (payload.length < 4) throw new Error('Truncated HWP control header');
        const control = Buffer.from(payload.subarray(0, 4)).reverse().toString('ascii');
        if (control === 'head' || control === 'foot') {
          audit.omittedHeaderFooterControls++;
          continue;
        }
        if (control === 'tbl ') {
          visitTable(children);
          continue;
        }
      }
      visit(children);
    }
  }

  visit(readRecords(bytes));
  return paragraphs;
}

export function extractHwp(bytes) {
  const compoundFile = openCompoundFile(bytes);
  const header = compoundFile.readStream('FileHeader');
  if (header.length < 256) throw new Error('Truncated HWP FileHeader');
  if (header.toString('ascii', 0, 17) !== 'HWP Document File' || header[17] !== 0 || header[35] !== 5) {
    throw new Error('Unsupported HWP version or signature');
  }
  const flags = header.readUInt32LE(36);
  if (flags & PROTECTED) throw new Error('Unsupported protected HWP document');
  const sections = compoundFile.streamNames
    .map((name) => ({name, number: Number(SECTION_NAME.exec(name)?.[1])}))
    .filter(({number}) => Number.isSafeInteger(number))
    .sort((a, b) => a.number - b.number);
  if (sections.length === 0 || sections.some(({number}, index) => number !== index)) {
    throw new Error('Missing or invalid HWP BodyText sections');
  }

  const audit = extractionAudit();
  const compressed = (flags & 1) !== 0;
  const paragraphs = [];
  for (const {name} of sections) {
    const stream = compoundFile.readStream(name);
    const section = compressed ? inflateRawSync(stream, {maxOutputLength: 64 * 1024 * 1024}) : stream;
    for (const paragraph of extractHwpSection(section, audit)) paragraphs.push(paragraph);
  }
  return {paragraphs, sectionCount: sections.length, compressed, ...audit};
}
