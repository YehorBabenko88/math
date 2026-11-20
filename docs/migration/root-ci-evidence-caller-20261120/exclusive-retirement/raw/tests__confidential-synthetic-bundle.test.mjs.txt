import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildSyntheticBundle, validateSyntheticBundle } from '../src/confidential-collector/synthetic-bundle.mjs';
import { verifyStoredZip } from '../src/evidence-receiver/zip.mjs';

const context = { sourceHead:'a'.repeat(40), sourceTree:'b'.repeat(40), runId:'123', attempt:'2', jobId:'456' };
const canary = 'c'.repeat(64);
const names = ['manifest.json','synthetic/fixture.bin','synthetic/package.json','synthetic/payload.json'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const validate = (bytes, ctx=context) => validateSyntheticBundle(bytes,{expectedSha256:sha(bytes),context:ctx});
test('builds a narrow deterministic synthetic archive and returns only frozen public metadata', () => {
 const bytes = buildSyntheticBundle(context,canary);
 assert.ok(Buffer.isBuffer(bytes));
 assert.ok(bytes.equals(buildSyntheticBundle(context,canary)));
 const files = verifyStoredZip(bytes,{expectedSha256:sha(bytes),expectedNames:names});
 assert.deepEqual([...files.keys()],names);
 assert.ok(!files.get('synthetic/fixture.bin').subarray(0,2).equals(Buffer.from('MZ')));
 const metadata = validate(bytes);
 assert.deepEqual(metadata,{scope:'SYNTHETIC_TRANSPORT_ONLY',...context,zipSha256:sha(bytes)});
 assert.ok(Object.isFrozen(metadata));
 assert.ok(!JSON.stringify(metadata).includes(canary));
});
for (const key of Object.keys(context)) test(`rejects wrong expected ${key}`, () => {
 assert.throws(()=>validate(buildSyntheticBundle(context,canary),{...context,[key]:key.startsWith('source')?'d'.repeat(40):'999'}));
});
test('rejects invalid context and malformed canary without echoing it', () => {
 for(const bad of ['', 'f'.repeat(63), 'G'.repeat(64)]) assert.throws(()=>buildSyntheticBundle(context,bad));
 for(const key of Object.keys(context)) assert.throws(()=>buildSyntheticBundle({...context,[key]:'../bad'},canary));
 assert.throws(()=>buildSyntheticBundle({...context,extra:true},canary));
});
test('rejects damaged ZIP even when outer digest is recomputed', () => {
 const bytes=Buffer.from(buildSyntheticBundle(context,canary)); bytes[50]^=1;
 assert.throws(()=>validate(bytes));
});

// Repack valid STORE records independently so semantic mutations keep ZIP CRCs valid.
function mutateJson(path, mutate) {
 const original=buildSyntheticBundle(context,canary);
 const files=verifyStoredZip(original,{expectedSha256:sha(original),expectedNames:names});
 const value=JSON.parse(files.get(path));mutate(value);files.set(path,Buffer.from(JSON.stringify(value)));
 if(path!=='manifest.json'){
  const manifest=JSON.parse(files.get('manifest.json'));
  const record=manifest.files.find(entry=>entry.path===path);
  record.sha256=sha(files.get(path));record.size=files.get(path).length;
  files.set('manifest.json',Buffer.from(JSON.stringify(manifest)));
 }
 const locals=[],centers=[];let offset=0;
 for(const [name,data] of files){
  let crc=0xffffffff;for(const byte of data){crc^=byte;for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
  const n=Buffer.from(name),l=Buffer.alloc(30),c=Buffer.alloc(46);
  l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt32LE(crc,14);l.writeUInt32LE(data.length,18);l.writeUInt32LE(data.length,22);l.writeUInt16LE(n.length,26);
  c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  locals.push(l,n,data);centers.push(c,n);offset+=30+n.length+data.length;
 }
 const central=Buffer.concat(centers),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(4,8);end.writeUInt16LE(4,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,central,end]);
}
for(const [label,mutate] of [
 ['missing context',m=>{delete m.runId;}],
 ['extra unsigned field',m=>{m.unsigned='opaque';}],
 ['missing inventory entry',m=>{m.files.pop();}],
 ['extra inventory entry',m=>{m.files.push({path:'unsigned',size:0,sha256:'0'.repeat(64)});}],
 ['wrong inventory hash',m=>{m.files[0].sha256='0'.repeat(64);}],
 ['wrong inventory size',m=>{m.files[0].size++;}],
])test(`rejects manifest ${label} in a valid ZIP`,()=>{
 const bytes=mutateJson('manifest.json',mutate);
 assert.equal(verifyStoredZip(bytes,{expectedSha256:sha(bytes),expectedNames:names}).size,4);
 assert.throws(()=>validate(bytes));
});
test('rejects opaque extra payload fields even with its manifest updated',()=>{
 const bytes=mutateJson('synthetic/payload.json',p=>{p.opaque={native:'untrusted'};});
 assert.throws(()=>validate(bytes));
});
test('rejects changed pinned package even with a valid ZIP and new outer hash',()=>{
 assert.throws(()=>validate(mutateJson('synthetic/package.json',p=>{p.source='synthetic/elsewhere.bin';})));
});
