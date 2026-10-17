import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as codec from '../src/book-ingestion/postgres-codec.mjs';
import {json,state} from '../src/book-ingestion/queue-contract.mjs';
const MAX=8*1024*1024;
const envelope=text=>{const b=Buffer.from(text);return {schemaVersion:'book-json/v1',encoding:'base64-utf8-json',byteLength:b.length,sha256:createHash('sha256').update(b).digest('hex'),data:b.toString('base64')};};
test('codec exposes lossless JSON roundtrip',()=>{
 assert.equal(typeof codec.encodeBookJSON,'function');
 const value={'\u0000\ud800':'a\u0000\udfff😀',decomposed:'e\u0301',composed:'é',negative:-0,array:Array(12000).fill(null),schemaVersion:'book-json/v1'};
 const expected=json(value,MAX), encoded=codec.encodeBookJSON(value);
 assert.deepEqual(encoded,envelope(JSON.stringify(expected)));
 assert.deepEqual(codec.decodeBookJSON(encoded),expected);
});
test('every UTF16 code unit survives encoding',()=>{
 const value=Array.from({length:256},(_,i)=>Array.from({length:256},(_,j)=>String.fromCharCode(i*256+j)).join(''));
 assert.deepEqual(codec.decodeBookJSON(codec.encodeBookJSON(value)),value);
});
test('seeded native JSON fuzz preserves JSON order and values',()=>{
 let seed=87235;const next=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 const str=()=>Array.from({length:1+Math.floor(next()*30)},()=>String.fromCharCode(next()*65536)).join('');
 for(let i=0;i<150;i++){const v={[str()]:[str(),next()*1e8,null,true,-0],normal:{[str()]:str()}};assert.equal(JSON.stringify(codec.decodeBookJSON(codec.encodeBookJSON(v))),JSON.stringify(json(v,MAX)));}
});
test('codec rejects hostile descriptors and proxies without executing traps',()=>{
 let calls=0;const proxy=new Proxy({},{get(){calls++;throw Error('trap');},ownKeys(){calls++;throw Error('trap');},getPrototypeOf(){calls++;throw Error('trap');}});
 for(const fn of [codec.encodeBookJSON,codec.decodeBookJSON]){assert.throws(()=>fn(proxy));assert.throws(()=>fn(Object.defineProperty({},'data',{get(){calls++;return 'x';},enumerable:true})));}
 assert.equal(calls,0);
 for(const v of [undefined,NaN,Infinity,1n,()=>{},new Date(),{a:undefined},[,],{constructor:1}])assert.throws(()=>codec.encodeBookJSON(v));
});
test('decoder rejects malformed, corrupt and noncanonical wire JSON',()=>{
 const good=envelope('{"a":1}');
 for(const v of [{...good,x:1},{...good,schemaVersion:'book-json/v2'},{...good,encoding:'x'},{...good,byteLength:1},{...good,sha256:'0'.repeat(64)},{...good,data:good.data+'='},{...good,data:good.data.replace(/.$/,'!')},{...good,byteLength:NaN},{...good,data:'A'.repeat(4*Math.ceil(MAX/3)+4)},envelope(' {"a":1}'),envelope('{"a":1,"a":2}'),envelope('-0'),envelope('1e0'),envelope('"\\u0061"'),envelope('\ufeff{}'),envelope('{"constructor":0}')])assert.throws(()=>codec.decodeBookJSON(v));
 const invalid=Buffer.from([0x22,0xff,0x22]);assert.throws(()=>codec.decodeBookJSON({...good,byteLength:3,sha256:createHash('sha256').update(invalid).digest('hex'),data:invalid.toString('base64')}));
});
test('global bytes, nodes and depth limits match native JSON',()=>{
 for(const v of ['a'.repeat(MAX),Array(20000).fill(null),Array.from({length:25}).reduce(v=>[v],null)])assert.throws(()=>codec.encodeBookJSON(v));
 const large='x'.repeat(MAX-10);assert.equal(codec.decodeBookJSON(codec.encodeBookJSON(large)),large);
 assert.throws(()=>codec.decodeBookJSON(envelope(JSON.stringify('x'.repeat(MAX)))));
});
test('job and review projections retain only SQL safe content',()=>{
 const job={sourceHash:'a'.repeat(64),edition:'\ud800\u0000',page:1,extractionVersion:'é',payload:{'\u0000':'\udfff'},state:'leased',attempts:1,token:'b'.repeat(64),leaseUntil:200,workerId:'\ud800',createdAt:1,updatedAt:2,checkpoint:{x:'\u0000'}};
 job.id=createHash('sha256').update(JSON.stringify([job.sourceHash,job.edition,job.page,job.extractionVersion])).digest('hex');
 const p=codec.projectBookJob(job);assert.deepEqual(p,{...job,wireProjection:'book-json/v1',edition:'wire:v1',extractionVersion:'wire:v1',payload:{},workerId:'wire:v1',checkpoint:{}});assert.match(JSON.stringify(p),/^[\x20-\x7e]+$/);
 const receipt={candidateDigest:'c'.repeat(64),decision:'approved',reviewer:'\ud800',reason:'é',reviewedAt:'2026-10-17T00:00:00.000Z',visualVerified:true};
 assert.deepEqual(codec.projectBookReview(receipt),{...receipt,wireProjection:'book-json/v1',reviewer:'wire:v1',reason:'wire:v1'});
 assert.throws(()=>codec.projectBookJob({...job,id:'bad'}));assert.throws(()=>codec.projectBookReview({...receipt,decision:'bad'}));
});
test('old readers cannot mistake a v1 projection for a valid native job even on placeholder collision',()=>{
 const job={sourceHash:'a'.repeat(64),edition:'wire:v1',page:1,extractionVersion:'wire:v1',payload:{evidence:'must not disappear'},state:'queued',attempts:0,createdAt:1,updatedAt:1};
 job.id=createHash('sha256').update(JSON.stringify([job.sourceHash,job.edition,job.page,job.extractionVersion])).digest('hex');
 assert.throws(()=>state({schemaVersion:1,maxAttempts:3,jobs:[codec.projectBookJob(job)]},3),/Invalid queue state/);
});
