const END = 0xfffffffe;
const FREE = 0xffffffff;
const FAT_SECTOR = 0xfffffffd;
const DIFAT_SECTOR = 0xfffffffc;
const SIGNATURE = Buffer.from('d0cf11e0a1b11ae1', 'hex');
const MINI_SECTOR_SIZE = 64;
const MINI_STREAM_CUTOFF = 4096;

// Microsoft MS-CFB, sections 2.2 through 2.6.
export function openCompoundFile(bytes) {
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error('Unsupported OLE signature');
  if (bytes.length < 512) throw new Error('Truncated OLE header');
  const majorVersion = bytes.readUInt16LE(26);
  const sectorShift = bytes.readUInt16LE(30);
  if (
    !((majorVersion === 3 && sectorShift === 9) || (majorVersion === 4 && sectorShift === 12)) ||
    bytes.readUInt16LE(28) !== 0xfffe ||
    bytes.readUInt16LE(32) !== 6 ||
    bytes.readUInt32LE(56) !== MINI_STREAM_CUTOFF
  ) throw new Error('Unsupported OLE header');
  const sectorSize = 2 ** sectorShift;
  if (bytes.length < sectorSize * 3 || bytes.length % sectorSize !== 0) {
    throw new Error('Truncated OLE sectors');
  }
  const sectorCount = bytes.length / sectorSize - 1;
  const directoryCount = bytes.readUInt32LE(40);
  const fatCount = bytes.readUInt32LE(44);
  const miniFatCount = bytes.readUInt32LE(64);
  const difatCount = bytes.readUInt32LE(72);
  if (fatCount === 0 || fatCount + difatCount + miniFatCount + directoryCount > sectorCount) {
    throw new Error('Invalid OLE sector counts');
  }
  function sector(index) {
    if (index >= sectorCount) throw new Error('Invalid OLE sector index');
    return bytes.subarray((index + 1) * sectorSize, (index + 2) * sectorSize);
  }

  const fatSectors = [];
  const allocationSectors = new Set();
  function addFatSector(index) {
    if (index === FREE) return;
    if (index >= sectorCount || allocationSectors.has(index)) throw new Error('Invalid OLE DIFAT entry');
    allocationSectors.add(index);
    fatSectors.push(index);
  }
  for (let offset = 76; offset < 512; offset += 4) addFatSector(bytes.readUInt32LE(offset));
  const difatSectors = [];
  let difatIndex = bytes.readUInt32LE(68);
  for (let i = 0; i < difatCount; i++) {
    if (allocationSectors.has(difatIndex)) throw new Error('OLE DIFAT cycle or overlap');
    const block = sector(difatIndex);
    allocationSectors.add(difatIndex);
    difatSectors.push(difatIndex);
    for (let offset = 0; offset < sectorSize - 4; offset += 4) addFatSector(block.readUInt32LE(offset));
    difatIndex = block.readUInt32LE(sectorSize - 4);
  }
  if (difatIndex !== END || fatSectors.length !== fatCount) throw new Error('Invalid OLE DIFAT chain');

  const fat = Buffer.concat(fatSectors.map(sector));
  if (fat.length / 4 < sectorCount) throw new Error('Truncated OLE FAT');
  for (const index of fatSectors) {
    if (fat.readUInt32LE(index * 4) !== FAT_SECTOR) throw new Error('Invalid OLE FAT marker');
  }
  for (const index of difatSectors) {
    if (fat.readUInt32LE(index * 4) !== DIFAT_SECTOR) throw new Error('Invalid OLE DIFAT marker');
  }

  function readChain(index, map, getSector, limit, count, label) {
    const visited = new Set();
    const blocks = [];
    while (index !== END) {
      if (visited.has(index)) throw new Error(`OLE ${label} cycle`);
      if (index >= limit || index >= map.length / 4) throw new Error(`Invalid OLE ${label} sector`);
      if (blocks.length === count) throw new Error(`OLE ${label} exceeds its declared length`);
      visited.add(index);
      blocks.push(getSector(index));
      index = map.readUInt32LE(index * 4);
    }
    if (count !== undefined && blocks.length !== count) throw new Error(`Truncated OLE ${label}`);
    return Buffer.concat(blocks);
  }
  function readRegular(index, count, label) {
    return readChain(index, fat, sector, sectorCount, count, label);
  }

  const directory = readRegular(bytes.readUInt32LE(48), majorVersion === 4 ? directoryCount : undefined, 'directory');
  const miniFat = readRegular(bytes.readUInt32LE(60), miniFatCount, 'mini FAT');
  function getEntry(index) {
    const offset = index * 128;
    if (offset + 128 > directory.length) throw new Error('Invalid OLE directory index');
    const nameLength = directory.readUInt16LE(offset + 64);
    const type = directory[offset + 66];
    if (
      ![1, 2, 5].includes(type) || nameLength < 4 || nameLength > 64 || nameLength % 2 !== 0 ||
      directory.readUInt16LE(offset + nameLength - 2) !== 0
    ) throw new Error('Invalid OLE directory entry');
    const name = directory.toString('utf16le', offset, offset + nameLength - 2);
    if (/[\/\\\0]/u.test(name)) throw new Error('Invalid OLE directory name');
    const size = majorVersion === 3
      ? directory.readUInt32LE(offset + 120)
      : Number(directory.readBigUInt64LE(offset + 120));
    if (size > bytes.length) throw new Error('Invalid OLE stream size');
    return {
      name, type, size,
      left: directory.readUInt32LE(offset + 68),
      right: directory.readUInt32LE(offset + 72),
      child: directory.readUInt32LE(offset + 76),
      first: directory.readUInt32LE(offset + 116),
    };
  }

  const root = getEntry(0);
  if (root.type !== 5) throw new Error('Invalid OLE root directory');
  const entries = new Map();
  const visited = new Set([0]);
  const pending = [[root.child, '']];
  while (pending.length > 0) {
    const [index, prefix] = pending.pop();
    if (index === FREE) continue;
    if (visited.has(index)) throw new Error('OLE directory cycle or duplicate entry');
    visited.add(index);
    const entry = getEntry(index);
    const name = prefix + entry.name;
    if (entry.type === 5 || entries.has(name)) throw new Error('Invalid OLE directory hierarchy');
    entries.set(name, entry);
    pending.push([entry.left, prefix], [entry.right, prefix]);
    if (entry.type === 1) pending.push([entry.child, name + '/']);
    else if (entry.child !== FREE) throw new Error('Invalid OLE stream directory child');
  }

  let miniStream;
  return {
    streamNames: [...entries].filter(([, entry]) => entry.type === 2).map(([name]) => name),
    readStream(name) {
      const entry = entries.get(name);
      if (entry?.type !== 2) throw new Error(`Missing OLE stream ${name}`);
      if (entry.size === 0) return Buffer.alloc(0);
      if (entry.size >= MINI_STREAM_CUTOFF) {
        return readRegular(entry.first, Math.ceil(entry.size / sectorSize), 'stream').subarray(0, entry.size);
      }
      miniStream ??= readRegular(root.first, Math.ceil(root.size / sectorSize), 'mini stream');
      function miniSector(index) {
        return miniStream.subarray(index * MINI_SECTOR_SIZE, (index + 1) * MINI_SECTOR_SIZE);
      }
      const limit = Math.floor(root.size / MINI_SECTOR_SIZE);
      const count = Math.ceil(entry.size / MINI_SECTOR_SIZE);
      return readChain(entry.first, miniFat, miniSector, limit, count, 'mini stream').subarray(0, entry.size);
    },
  };
}
