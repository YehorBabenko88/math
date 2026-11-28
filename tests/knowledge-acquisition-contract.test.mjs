import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKnowledgeGap} from '../src/knowledge/acquisition-contract.mjs';
const contextHash='a'.repeat(64);
for(const reason of ['MISSING_MATHEMATICAL_PREREQUISITE']) test(reason,()=>{
  const g=buildKnowledgeGap({contextHash,methodId:'acf',reason});
  assert.equal(g.status,'ABSTAIN');assert.equal(g.reason,reason);assert.equal(g.exportAuthorized,false);assert.ok(Object.isFrozen(g));
});
test('reject caller authority',()=>assert.throws(()=>buildKnowledgeGap({contextHash,methodId:'acf',reason:'MISSING_MATHEMATICAL_PREREQUISITE',exportAuthorized:true})));
test('reject accessor without invoking it',()=>{let invoked=false;const input={contextHash,methodId:'acf',get reason(){invoked=true;return 'MISSING_MATHEMATICAL_PREREQUISITE'}};assert.throws(()=>buildKnowledgeGap(input));assert.equal(invoked,false)});
for(const reason of ['INSUFFICIENT_COVERAGE','COVERAGE','CAUSAL_SAMPLE','QUALITY','RESOURCE','PORT_MISMATCH','ASSUMPTIONS','VALIDATION','NO_DEVELOPMENT_EVIDENCE','NEGATIVE_RESULT']) test('reject operational or unconfirmed gap '+reason,()=>assert.throws(()=>buildKnowledgeGap({contextHash,methodId:'acf',reason})));
test('decoded null-prototype DTO',()=>{const r=Object.assign(Object.create(null),{contextHash,methodId:'acf',reason:'MISSING_MATHEMATICAL_PREREQUISITE'});assert.equal(buildKnowledgeGap(r).verified,false)});
test('reject legacy prefixed hash',()=>assert.throws(()=>buildKnowledgeGap({contextHash:'sha256:'+contextHash,methodId:'acf',reason:'MISSING_MATHEMATICAL_PREREQUISITE'})));
test('reject proxy without traps',()=>{let calls=0;const p=new Proxy({}, {ownKeys(){calls++;return []}});assert.throws(()=>buildKnowledgeGap(p));assert.equal(calls,0)});
test('reject caller byte view without reading its getter',()=>{let calls=0;const p=new Uint8Array(4);Object.defineProperty(p,'byteLength',{get(){calls++;return 0}});assert.throws(()=>buildKnowledgeGap(p));assert.equal(calls,0)});
