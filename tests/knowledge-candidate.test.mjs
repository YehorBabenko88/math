import test from 'node:test';
import assert from 'node:assert/strict';
import { createCandidate, createEdge } from '../src/knowledge/candidate-graph.mjs';
const source_hash='sha256:'+'a'.repeat(64);
const input=()=>({kind:'THEOREM',statement:{format:'text',content:'A implies A'},provenance:{source_id:'book:1',source_hash,page:1,extraction_method:'OCR'}});
test('candidate remains unverified and retains provenance',()=>{const c=createCandidate(input());assert.equal(c.status,'CANDIDATE');assert.equal(c.verification,null);assert.equal(c.provenance.page,1);assert.ok(Object.isFrozen(c));});
test('adapters cannot assert VERIFIED or forge verification',()=>{assert.throws(()=>createCandidate({...input(),status:'VERIFIED'}));assert.throws(()=>createCandidate({...input(),verification:{ok:true}}));});
test('missing provenance fails closed',()=>{const i=input();delete i.provenance.page;assert.throws(()=>createCandidate(i));});
test('revision hash changes with statement or source',()=>{const a=createCandidate(input());const b=input();b.statement.content='A implies B';assert.notEqual(a.revision_id,createCandidate(b).revision_id);});
test('typed edges reject unknown types',()=>{assert.equal(createEdge({type:'DEPENDS_ON',from_revision:'a',to_revision:'b'}).status,'CANDIDATE');assert.throws(()=>createEdge({type:'TRUST_ME',from_revision:'a',to_revision:'b'}));});

test('unknown fields and prototype pollution are rejected',()=>{
  assert.throws(()=>createCandidate({...input(),status:'CANDIDATE',unexpected:true}));
  assert.throws(()=>createCandidate({...input(),statement:{format:'text',content:'x',extra:1}}));
  assert.throws(()=>createCandidate({...input(),provenance:{...input().provenance,extra:1}}));
});
test('invalid context hash and source hash fail closed',()=>{
  assert.throws(()=>createCandidate({...input(),statement:{format:'text',content:'x',context_hash:'bad'}}));
  assert.throws(()=>createCandidate({...input(),provenance:{...input().provenance,source_hash:'bad'}}));
});
test('identical input produces identical revision hash',()=>{
  assert.equal(createCandidate(input()).revision_id,createCandidate(input()).revision_id);
});
test('edge payload cannot smuggle verification',()=>{
  assert.throws(()=>createEdge({type:'PROVES',from_revision:'a',to_revision:'b',status:'VERIFIED'}));
});

test('candidate rejects mutable provenance getters without invoking them',()=>{
 const value=input();let reads=0;
 Object.defineProperty(value.provenance,'source_hash',{enumerable:true,get(){return ++reads===1?source_hash:'not-a-digest';}});
 assert.throws(()=>createCandidate(value),/invalid data record/);
 assert.equal(reads,0);
});

test('candidate rejects root, statement and provenance proxies without invoking traps',()=>{
 for(const field of [null,'statement','provenance']){
  const value=input();let calls=0;
  const hostile=new Proxy(field===null?value:value[field],{
   getPrototypeOf(){calls++;throw Error('proxy trap invoked');},
   ownKeys(){calls++;throw Error('proxy trap invoked');},
   get(){calls++;throw Error('proxy trap invoked');},
  });
  const payload=field===null?hostile:{...value,[field]:hostile};
  assert.throws(()=>createCandidate(payload),/invalid data record/);
  assert.equal(calls,0);
 }
});

test('candidate rejects accessor fields at every record boundary',()=>{
 for(const [field,key] of [[null,'kind'],['statement','content'],['provenance','page']]){
  const value=input();let reads=0;
  Object.defineProperty(field===null?value:value[field],key,{enumerable:true,get(){reads++;return 'unexpected';}});
  assert.throws(()=>createCandidate(value),/invalid data record/);
  assert.equal(reads,0);
 }
});

test('graph records reject hidden and symbol properties',()=>{
 for(const field of [null,'statement','provenance'])for(const key of ['hidden',Symbol('hidden')]){
  const value=input();
  Object.defineProperty(field===null?value:value[field],key,{value:'unexpected',enumerable:typeof key==='symbol'});
  assert.throws(()=>createCandidate(value),/invalid data record/);
 }
});

test('edge records reject getters and proxies without executing them',()=>{
 let calls=0;
 const edge={type:'DEPENDS_ON',from_revision:'a',to_revision:'b'};
 Object.defineProperty(edge,'type',{enumerable:true,get(){calls++;return 'DEPENDS_ON';}});
 assert.throws(()=>createEdge(edge),/invalid data record/);
 assert.throws(()=>createEdge(new Proxy({},{getPrototypeOf(){calls++;throw Error('proxy trap invoked');}})),/invalid data record/);
 assert.equal(calls,0);
});
