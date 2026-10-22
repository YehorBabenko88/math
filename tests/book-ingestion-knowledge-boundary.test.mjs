import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateDigest,assessKnowledge,sameDigest} from '../src/book-ingestion/knowledge-boundary.mjs';

const source={sourceHash:'a'.repeat(64),edition:'Test edition',page:1,extractionVersion:'ocr-v1',text:'2 + 2 = 5'};
test('unverified OCR and LLM candidates never become mathematical verification',()=>{
 for(const status of ['EXTRACTED','LLM_CANDIDATE','SOURCE_REVIEWED','FORMALIZED','REJECTED']){
  const result=assessKnowledge({source,status});
  assert.equal(result.mathematicallyVerified,false);
  assert.equal(result.status,status);
 }
});
test('claimed verified status and forged receipts fail closed',()=>{
 assert.throws(()=>assessKnowledge({source,status:'KERNEL_VERIFIED'}),/Independent proof kernel/);
 assert.throws(()=>assessKnowledge({source,status:'LLM_CANDIDATE'},{kernelReceipt:{approved:true}}),/Untrusted kernel receipt/);
});
test('candidate digest binds source text, page, edition and extraction version',()=>{
 const original=candidateDigest(source);
 for(const patch of [{text:'2 + 2 = 4'},{page:2},{edition:'Other edition'},{extractionVersion:'ocr-v2'}])
  assert.notEqual(candidateDigest({...source,...patch}),original);
 assert.equal(sameDigest(original,original),true);
 assert.equal(sameDigest(original,'b'.repeat(64)),false);
});
test('reject malformed provenance and status',()=>{
 for(const bad of [{...source,page:0},{...source,sourceHash:'bad'},{...source,text:''},{...source,extra:true}])
  assert.throws(()=>candidateDigest(bad),/Invalid extraction candidate/);
 assert.throws(()=>assessKnowledge({source,status:'VERIFIED'}),/Invalid knowledge status/);
});
