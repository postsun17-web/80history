import {openSync, closeSync, fstatSync, readSync} from 'node:fs';

const BLOCK_SIZE = 512;
const utf8 = new TextDecoder('utf-8', {fatal: true});

function readAt(fd, offset, size) {
  const bytes = Buffer.alloc(size);
  let count = 0;
  while (count < size) {
    const read = readSync(fd, bytes, count, size - count, offset + count);
    if (read === 0) throw new Error('Truncated TAR member');
    count += read;
  }
  return bytes;
}

function stringField(bytes) {
  const end = bytes.indexOf(0);
  return utf8.decode(end < 0 ? bytes : bytes.subarray(0, end));
}

function tarNumber(bytes) {
  // POSIX octal or GNU base-256, limited to nonnegative safe byte offsets.
  if (bytes[0] === 0x80) {
    let number = 0;
    for (const byte of bytes.subarray(1)) number = number * 256 + byte;
    if (Number.isSafeInteger(number)) return number;
  } else {
    const value = stringField(bytes).trim();
    if (/^[0-7]+$/u.test(value)) {
      const number = Number.parseInt(value, 8);
      if (Number.isSafeInteger(number)) return number;
    }
  }
  throw new Error('Invalid TAR numeric field');
}

function paxFields(bytes) {
  const fields = new Map();
  for (let offset = 0; offset < bytes.length;) {
    const space = bytes.indexOf(32, offset);
    const length = space < 0 ? '' : bytes.toString('ascii', offset, space);
    const end = offset + Number(length);
    const equals = bytes.indexOf(61, space + 1);
    if (!/^[1-9]\d*$/u.test(length) || end > bytes.length ||
        equals <= space + 1 || equals >= end - 1 || bytes[end - 1] !== 10) {
      throw new Error('Invalid TAR PAX metadata');
    }
    const key = utf8.decode(bytes.subarray(space + 1, equals));
    if (key === 'path' || key === 'size' || key.startsWith('GNU.sparse.')) {
      fields.set(key, utf8.decode(bytes.subarray(equals + 1, end - 1)));
    }
    offset = end;
  }
  return fields;
}

export function withTarMembers(path, select, useMembers) {
  const fd = openSync(path, 'r');
  try {
    const fileSize = fstatSync(fd).size;
    const members = new Map();
    let local = new Map();
    let offset = 0;
    while (offset + BLOCK_SIZE * 2 <= fileSize) {
      const header = readAt(fd, offset, BLOCK_SIZE);
      if (header.every((byte) => byte === 0)) {
        if (local.size > 0 || readAt(fd, offset + BLOCK_SIZE, BLOCK_SIZE).some((byte) => byte !== 0)) {
          throw new Error('Invalid TAR end marker');
        }
        return useMembers({
          members,
          read(name) {
            const member = members.get(name);
            if (!member) throw new Error('Missing selected TAR member');
            return readAt(fd, member.offset, member.size);
          },
        });
      }
      const checksum = tarNumber(header.subarray(148, 156));
      const calculated = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
      if (checksum !== calculated) throw new Error('Invalid TAR header checksum');
      const type = String.fromCharCode(header[156]);
      const prefix = header.toString('ascii', 257, 263) === 'ustar\0'
        ? stringField(header.subarray(345, 500))
        : '';
      const name = [prefix, stringField(header.subarray(0, 100))].filter(Boolean).join('/');
      let size = tarNumber(header.subarray(124, 136));
      const payload = offset + BLOCK_SIZE;
      if (type === 'x' || type === 'g' || type === 'L' || type === 'K') {
        if (size > 1024 * 1024 || payload + size > fileSize) throw new Error('Invalid TAR extension size');
        if (type === 'x' || type === 'g') {
          const fields = paxFields(readAt(fd, payload, size));
          if (type === 'x') {
            for (const entry of fields) local.set(...entry);
          } else if (fields.size > 0) {
            throw new Error('Unsupported global TAR PAX path, size or sparse metadata');
          }
        } else if (type === 'L') {
          local.set('path', stringField(readAt(fd, payload, size)));
        }
      } else {
        const memberName = local.get('path') ?? name;
        if (local.has('size')) {
          const value = local.get('size');
          size = Number(value);
          if (!/^\d+$/u.test(value) || !Number.isSafeInteger(size)) throw new Error('Invalid TAR PAX size');
        }
        if (select(memberName)) {
          if (type !== '0' && type !== '\0') throw new Error('Selected TAR member is not a regular file');
          if ([...local.keys()].some((key) => key.startsWith('GNU.sparse.'))) {
            throw new Error('Unsupported sparse TAR member');
          }
          if (members.has(memberName)) throw new Error('Duplicate selected TAR member');
          if (size > 128 * 1024 * 1024) throw new Error('Selected TAR member exceeds size limit');
          members.set(memberName, {offset: payload, size});
        }
        local = new Map();
      }
      offset = payload + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
      if (offset > fileSize) throw new Error('Truncated TAR member padding');
    }
    throw new Error('Missing TAR end marker');
  } finally {
    closeSync(fd);
  }
}
