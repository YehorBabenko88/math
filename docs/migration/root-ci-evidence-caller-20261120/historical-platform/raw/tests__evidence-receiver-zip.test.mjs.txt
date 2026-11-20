import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyStoredZip } from '../src/evidence-receiver/zip.mjs';

const digest = b => createHash('sha256').update(b).digest('hex');
// Independent bitwise CRC fixture builder; the standard check vector is below.
function crc(b) {
  let c = 0xffffffff;
  for (const v of b) { c ^= v; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
}
function zip(names = ['a.txt'], data = Buffer.from('123456789')) {
  const locals = [], centers = []; let offset = 0;
  for (const name of names) {
    const n = Buffer.from(name), l = Buffer.alloc(30), c = Buffer.alloc(46);
    l.writeUInt32LE(0x04034b50); l.writeUInt16LE(20, 4); l.writeUInt32LE(crc(data), 14);
    l.writeUInt32LE(data.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(n.length, 26);
    c.writeUInt32LE(0x02014b50); c.writeUInt16LE(0x0314, 4); c.writeUInt16LE(20, 6);
    l.copy(c, 8, 6, 26); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(0x81a40000, 38); c.writeUInt32LE(offset, 42);
    locals.push(l, n, data); centers.push(c, n); offset += l.length + n.length + data.length;
  }
  const directory = Buffer.concat(centers), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
const run = (b, names = ['a.txt'], extra = {}) => verifyStoredZip(b, { expectedSha256: digest(b), expectedNames: names, ...extra });
test('accepts STORE bytes and returns independent file buffers', () => {
  assert.equal(crc(Buffer.from('123456789')), 0xcbf43926);
  const b = zip(); const files = run(b); assert.equal(files.get('a.txt').toString(), '123456789');
  b.fill(0); assert.equal(files.get('a.txt').toString(), '123456789');
});
test('checks whole archive digest', () => assert.throws(() => run(zip(), ['a.txt'], { expectedSha256: '0'.repeat(64) }), /digest/i));
const mutations = {
  'bad CRC': (b,c) => b.writeUInt32LE(1, c+16),
  'both CRC wrong': (b,c) => { b.writeUInt32LE(1,14); b.writeUInt32LE(1,c+16); },
  'local name mismatch': b => b[30] = 98,
  'compression': (b,c) => { b.writeUInt16LE(8,8); b.writeUInt16LE(8,c+10); },
  'encryption': (b,c) => { b.writeUInt16LE(1,6); b.writeUInt16LE(1,c+8); },
  'descriptor': (b,c) => { b.writeUInt16LE(8,6); b.writeUInt16LE(8,c+8); },
  'local extra': b => b.writeUInt16LE(1,28),
  'central extra': (b,c) => b.writeUInt16LE(1,c+30),
  'central comment': (b,c) => b.writeUInt16LE(1,c+32),
  'symlink': (b,c) => b.writeUInt32LE(0xa1ff0000,c+38),
  'gitlink': (b,c) => b.writeUInt32LE(0xe0000000,c+38),
  'device': (b,c) => b.writeUInt32LE(0x21ff0000,c+38),
  'DOS directory': (b,c) => b.writeUInt32LE(0x10,c+38),
  'offset overlap': (b,c) => b.writeUInt32LE(1,c+42),
  'disk': b => b.writeUInt16LE(1,b.length-18),
  'EOCD comment': b => b.writeUInt16LE(1,b.length-2),
  'zip64 version': (b,c) => b.writeUInt16LE(45,c+6),
  'size mismatch': (b,c) => b.writeUInt32LE(10,c+24),
};
for (const [name, mutate] of Object.entries(mutations)) test(`rejects ${name}`, () => {
  const b = zip(); mutate(b, b.readUInt32LE(b.length-6)); assert.throws(() => run(b));
});
for (const name of ['../x', '/x', 'a//b', 'a/./b', 'C:x', 'a\\b', 'é.txt', 'a/']) {
  test(`rejects unsafe name ${JSON.stringify(name)}`, () => assert.throws(() => run(zip([name]), [name])));
}
test('rejects duplicate and case aliases', () => {
  assert.throws(() => run(zip(['a.txt','a.txt']), ['a.txt','a.txt']));
  assert.throws(() => run(zip(['A.txt','a.txt']), ['A.txt','a.txt']));
});
test('requires exact sorted expected inventory', () => {
  assert.throws(() => run(zip(), ['b.txt'])); assert.throws(() => run(zip(['b','a']), ['b','a']));
});
test('rejects truncation, prefix, trailing and inserted bytes', () => {
  const b=zip(); for (const malformed of [b.subarray(0,-1),Buffer.concat([Buffer.from('x'),b]),Buffer.concat([b,Buffer.from('x')]),Buffer.concat([b.subarray(0,44),Buffer.from('x'),b.subarray(44)])]) assert.throws(() => run(malformed));
});
test('enforces entry and total-byte limits', () => {
  assert.throws(() => run(zip(), ['a.txt'], { maxTotalBytes: 8 }));
  const names=Array.from({length:17},(_,i)=>`f${String(i).padStart(2,'0')}`);
  assert.throws(() => run(zip(names), names));
  assert.throws(() => run(zip(), ['a.txt'], {maxTotalBytes:33554433}));
});
