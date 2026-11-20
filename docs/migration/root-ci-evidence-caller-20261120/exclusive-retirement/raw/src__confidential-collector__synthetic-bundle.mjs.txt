import { createHash } from 'node:crypto';
import { verifyStoredZip } from '../evidence-receiver/zip.mjs';
import { exact, need, strictJson, oid, id, hex } from '../evidence-receiver/strict.mjs';

const scope = 'SYNTHETIC_TRANSPORT_ONLY';
const contextKeys = ['sourceHead','sourceTree','runId','attempt','jobId'];
const names = ['manifest.json','synthetic/fixture.bin','synthetic/package.json','synthetic/payload.json'];
const fixture = Buffer.from('Synthetic confidential transport fixture. Plain text only; never executable.\n');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = object => Buffer.from(JSON.stringify(object));
function checkContext(context) {
 exact(context,contextKeys);
 need(oid(context.sourceHead)&&oid(context.sourceTree)&&id(context.runId)&&id(context.attempt)&&id(context.jobId));
}
const packageObject = () => ({scope,source:'synthetic/fixture.bin',sha256:sha(fixture),size:fixture.length});
function crc32(bytes) {
 let crc=0xffffffff;
 for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function storeZip(files) {
 const locals=[],centers=[]; let offset=0;
 for(const name of names){
  const data=files.get(name), filename=Buffer.from(name), crc=crc32(data);
  const local=Buffer.alloc(30); local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);
  local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
  const center=Buffer.alloc(46);center.writeUInt32LE(0x02014b50);center.writeUInt16LE(20,4);center.writeUInt16LE(20,6);
  center.writeUInt32LE(crc,16);center.writeUInt32LE(data.length,20);center.writeUInt32LE(data.length,24);center.writeUInt16LE(filename.length,28);center.writeUInt32LE(offset,42);
  locals.push(local,filename,data);centers.push(center,filename);offset+=local.length+filename.length+data.length;
 }
 const central=Buffer.concat(centers),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,central,end]);
}
function manifestObject(files,context) {
 return {scope,...context,files:names.slice(1).map(path=>({path,sha256:sha(files.get(path)),size:files.get(path).length}))};
}
export function buildSyntheticBundle(context,canaryHex) {
 checkContext(context); need(hex(canaryHex));
 const files=new Map([
  ['synthetic/fixture.bin',fixture],
  ['synthetic/package.json',json(packageObject())],
  ['synthetic/payload.json',json({kind:'SYNTHETIC_CONFIDENTIAL_TRANSPORT',canaryHex,...context})],
 ]);
 files.set('manifest.json',json(manifestObject(files,context)));
 return storeZip(files);
}
export function validateSyntheticBundle(bytes,{expectedSha256,context}={}) {
 checkContext(context);
 const files=verifyStoredZip(bytes,{expectedSha256,expectedNames:names,maxTotalBytes:65536});
 need([...files.keys()].every((name,index)=>name===names[index]));
 need(files.get('synthetic/fixture.bin').equals(fixture));
 const pkg=strictJson(files.get('synthetic/package.json'));
 exact(pkg,['scope','source','sha256','size']);
 for(const [key,value] of Object.entries(packageObject()))need(pkg[key]===value);
 const payload=strictJson(files.get('synthetic/payload.json'));
 exact(payload,['kind','canaryHex',...contextKeys]);
 need(payload.kind==='SYNTHETIC_CONFIDENTIAL_TRANSPORT'&&hex(payload.canaryHex));
 for(const key of contextKeys)need(payload[key]===context[key]);
 const manifest=strictJson(files.get('manifest.json'));
 exact(manifest,['scope',...contextKeys,'files']);need(manifest.scope===scope);
 for(const key of contextKeys)need(manifest[key]===context[key]);
 need(Array.isArray(manifest.files)&&manifest.files.length===3);
 for(let i=0;i<3;i++){
  const record=manifest.files[i],path=names[i+1],data=files.get(path);
  exact(record,['path','sha256','size']);need(record.path===path&&record.sha256===sha(data)&&record.size===data.length);
 }
 return Object.freeze({scope,...context,zipSha256:sha(bytes)});
}
