import assert from 'node:assert/strict';
import test from 'node:test';
import {deflateRawSync} from 'node:zlib';
import {extractHwp, extractHwpSection} from '../tools/search-import-hwp.mjs';

const end = 0xfffffffe;
const free = 0xffffffff;

function record(tag: number, level: number, payload: Buffer, extended = false) {
  const header = Buffer.alloc(extended ? 8 : 4);
  header.writeUInt32LE((((extended ? 4095 : payload.length) << 20) | (level << 10) | tag) >>> 0);
  if (extended) header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

function textRecord(level: number, value: string, extended = false) {
  return record(67, level, Buffer.from(value + '\r', 'utf16le'), extended);
}

function cell(row: number, column: number, offset = 6) {
  const payload = Buffer.alloc(offset + 26);
  payload.writeUInt16LE(column, offset);
  payload.writeUInt16LE(row, offset + 2);
  payload.writeUInt16LE(1, offset + 4);
  payload.writeUInt16LE(1, offset + 6);
  return record(72, 2, payload);
}

test('skips complete controls while preserving Hanja and one-unit controls', () => {
  const field = '\u0003捤獥汤捯ABCDEFGHI'.slice(0, 7) + '\u0003';
  const tab = '\u0009' + '\u0000'.repeat(6) + '\u0009';
  assert.deepEqual(extractHwpSection(textRecord(1, '교회(敎會)' + field + tab + '信仰\u0018생활', true)), ['교회(敎會) 信仰-생활']);
  assert.throws(() => extractHwpSection(textRecord(1, '신앙\u0003')), /control/);
  assert.throws(() => extractHwpSection(textRecord(1, '신앙', true).subarray(0, -1)), /truncated/i);
});

test('filters header and footer subtrees, keeps notes and reads table cells in row order', () => {
  const control = (id: string) => record(71, 1, Buffer.from([...id].reverse().join('')));
  const table = Buffer.alloc(20);
  table.writeUInt16LE(2, 4);
  table.writeUInt16LE(2, 6);
  for (const offset of [6, 8]) {
    const section = Buffer.concat([
    textRecord(1, '본문'),
    control('head'), textRecord(3, '머리말'), textRecord(5, '머리말 표'),
    control('foot'), textRecord(3, '꼬리말'),
    control('fn  '), textRecord(3, '각주'),
    control('tbl '), record(77, 2, table),
    cell(1, 0, offset), textRecord(3, '둘째 줄'),
    cell(0, 1, offset), textRecord(3, '둘째 칸'), textRecord(3, '둘째 칸의 둘째 문단'),
    cell(0, 0, offset), textRecord(3, '첫째 칸'),
    record(66, 0, Buffer.alloc(22)), textRecord(1, '다음 본문'),
  ]);
    assert.deepEqual(extractHwpSection(section), [
      '본문', '각주', '첫째 칸', '둘째 칸', '둘째 칸의 둘째 문단', '둘째 줄', '다음 본문',
    ]);
  }
});

function makeMiniHwp(compressed: boolean) {
  const bytes = Buffer.alloc(5 * 512);
  Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(bytes);
  bytes.writeUInt16LE(3, 26);
  bytes.writeUInt16LE(0xfffe, 28);
  bytes.writeUInt16LE(9, 30);
  bytes.writeUInt16LE(6, 32);
  bytes.writeUInt32LE(1, 44);
  bytes.writeUInt32LE(1, 48);
  bytes.writeUInt32LE(4096, 56);
  bytes.writeUInt32LE(2, 60);
  bytes.writeUInt32LE(1, 64);
  bytes.writeUInt32LE(end, 68);
  bytes.fill(0xff, 76, 1024);
  bytes.writeUInt32LE(0, 76);
  bytes.writeUInt32LE(0xfffffffd, 512);
  for (const index of [1, 2, 3]) bytes.writeUInt32LE(end, 512 + index * 4);

  function entry(id: number, name: string, type: number, right: number, child: number, sector: number, size: number) {
    const start = 1024 + id * 128;
    const nameBytes = Buffer.from(name + '\0', 'utf16le');
    nameBytes.copy(bytes, start);
    bytes.writeUInt16LE(nameBytes.length, start + 64);
    bytes.writeUInt8(type, start + 66);
    bytes.writeUInt32LE(free, start + 68);
    bytes.writeUInt32LE(right, start + 72);
    bytes.writeUInt32LE(child, start + 76);
    bytes.writeUInt32LE(sector, start + 116);
    bytes.writeUInt32LE(size, start + 120);
  }

  const section = textRecord(1, '영락교회 永樂敎會');
  const body = compressed ? deflateRawSync(section) : section;
  entry(0, 'Root Entry', 5, free, 1, 3, 320);
  entry(1, 'FileHeader', 2, 2, free, 0, 256);
  entry(2, 'BodyText', 1, free, 3, 0, 0);
  entry(3, 'Section0', 2, free, free, 4, body.length);
  bytes.fill(0xff, 1536, 2048);
  [1, 2, 3, end, end].forEach((value, index) => bytes.writeUInt32LE(value, 1536 + index * 4));
  bytes.write('HWP Document File', 2048);
  bytes.writeUInt8(5, 2048 + 35);
  bytes.writeUInt32LE(Number(compressed), 2048 + 36);
  body.copy(bytes, 2048 + 256);
  return bytes;
}

test('reads plain and raw-deflated sections through the mini FAT', () => {
  assert.deepEqual(extractHwp(makeMiniHwp(false)).paragraphs, ['영락교회 永樂敎會']);
  assert.deepEqual(extractHwp(makeMiniHwp(true)).paragraphs, ['영락교회 永樂敎會']);
});

test('rejects corrupt FAT and mini FAT chains, encryption and truncated data', () => {
  const fatCycle = makeMiniHwp(false);
  fatCycle.writeUInt32LE(1, 516);
  assert.throws(() => extractHwp(fatCycle), /cycle/i);
  const miniFatCycle = makeMiniHwp(false);
  miniFatCycle.writeUInt32LE(0, 1536);
  assert.throws(() => extractHwp(miniFatCycle), /cycle/i);
  const encrypted = makeMiniHwp(false);
  encrypted.writeUInt32LE(2, 2048 + 36);
  assert.throws(() => extractHwp(encrypted), /protected/i);
  assert.throws(() => extractHwp(makeMiniHwp(false).subarray(0, -1)), /truncated/i);
});
