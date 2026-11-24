import { createHash, timingSafeEqual } from 'node:crypto';

const LIMIT = 33554432;
const fail = reason => { throw new Error(`Invalid STORE ZIP: ${reason}`); };
function safeName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9_./-]+$/.test(name)
    && name.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

/** Read-only, deliberately narrow protocol: contiguous STORE files, no ZIP extensions. */
export function verifyStoredZip(buffer, { expectedSha256, expectedNames, maxTotalBytes = LIMIT } = {}) {
  if (!Buffer.isBuffer(buffer)) fail('Buffer required');
  if (!Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < 0 || maxTotalBytes > LIMIT) fail('byte limit');
  // Bound the whole input as well as the sum of file sizes before hashing/parsing.
  if (buffer.length > LIMIT || buffer.length < 22) fail('archive size');
  if (typeof expectedSha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(expectedSha256)
    || !timingSafeEqual(createHash('sha256').update(buffer).digest(), Buffer.from(expectedSha256, 'hex'))) fail('digest mismatch');
  if (!Array.isArray(expectedNames) || expectedNames.length < 1 || expectedNames.length > 16) fail('expected inventory');
  const aliases = new Set();
  for (let i = 0; i < expectedNames.length; i++) {
    const name = expectedNames[i];
    if (!safeName(name) || (i > 0 && expectedNames[i-1] >= name) || aliases.has(name.toLowerCase())) fail('unsafe or duplicate expected name');
    aliases.add(name.toLowerCase());
  }
  const end = buffer.length - 22;
  const u16 = offset => buffer.readUInt16LE(offset);
  const u32 = offset => buffer.readUInt32LE(offset);
  if (u32(end) !== 0x06054b50 || u16(end+4) || u16(end+6) || u16(end+20)) fail('EOCD, disks or comment');
  const count = u16(end+10), centralSize = u32(end+12), centralOffset = u32(end+16);
  if (count !== expectedNames.length || u16(end+8) !== count || centralOffset + centralSize !== end) fail('central directory bounds');
  let center = centralOffset, local = 0, total = 0;
  const files = new Map(), seen = new Set();
  for (let i = 0; i < count; i++) {
    if (center + 46 > end || u32(center) !== 0x02014b50) fail('central header');
    const made = u16(center+4), version = u16(center+6), flags = u16(center+8), method = u16(center+10);
    const crc = u32(center+16), size = u32(center+20), unpacked = u32(center+24), nameSize = u16(center+28);
    if (![10,20].includes(version) || ![0,3].includes(made >>> 8) || ![10,20].includes(made & 255)) fail('unsupported ZIP version');
    if (flags !== 0 || method !== 0) fail('unsupported compression or flags; STORE only');
    if (size !== unpacked || u16(center+30) || u16(center+32) || u16(center+34) || u16(center+36)) fail('sizes or extensions');
    const attr = u32(center+38), mode = attr >>> 16;
    if ((attr & 0xffff & ~0x20) !== 0 || (mode !== 0 && (mode & 0xf000) !== 0x8000)) fail('non-regular file attributes');
    if (center + 46 + nameSize > end || u32(center+42) !== local) fail('name bounds or local offset');
    const nameBytes = buffer.subarray(center+46,center+46+nameSize);
    const name = nameBytes.toString('ascii');
    if (!safeName(name) || !Buffer.from(name,'ascii').equals(nameBytes) || seen.has(name.toLowerCase()) || !aliases.has(name.toLowerCase()) || !expectedNames.includes(name)) fail('unsafe or unexpected name');
    seen.add(name.toLowerCase());
    if (local+30 > centralOffset || u32(local) !== 0x04034b50) fail('local header');
    if (u16(local+4) !== version || u16(local+6) !== flags || u16(local+8) !== method
      || u16(local+10) !== u16(center+12) || u16(local+12) !== u16(center+14)
      || u32(local+14) !== crc || u32(local+18) !== size || u32(local+22) !== unpacked
      || u16(local+26) !== nameSize || u16(local+28) !== 0) fail('local/central mismatch');
    const start = local+30+nameSize, finish = start+size;
    total += size;
    if (finish > centralOffset || total > maxTotalBytes || !buffer.subarray(local+30,start).equals(nameBytes)) fail('file bounds, limit or local name');
    const data = buffer.subarray(start,finish);
    if (crc32(data) !== crc) fail('CRC mismatch');
    files.set(name,Buffer.from(data)); local = finish; center += 46+nameSize;
  }
  if (local !== centralOffset || center !== end || seen.size !== expectedNames.length) fail('unaccounted bytes');
  return files;
}
