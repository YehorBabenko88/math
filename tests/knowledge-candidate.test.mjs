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
