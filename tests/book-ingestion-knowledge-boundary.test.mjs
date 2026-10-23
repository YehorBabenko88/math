import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateDigest,assessKnowledge,sameDigest,rejectUntrustedVerification} from '../src/book-ingestion/knowledge-boundary.mjs';

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

test('queue publication guard rejects explicit untrusted verification claims',()=>{
 for(const result of [
  {status:'KERNEL_VERIFIED'},
  {knowledgeStatus:'VERIFIED'},
  {verificationStatus:'PROVEN'},
  {mathematicallyVerified:true},
  {mathematicallyVerified:'false'},
  {nested:{status:'KERNEL_VERIFIED'}},
  {results:[{verificationStatus:'PROVEN'}]}
 ])assert.throws(()=>rejectUntrustedVerification(result),/Independent proof kernel/);
 for(const result of [{digest:'a'.repeat(64)},{status:'LLM_CANDIDATE'},{mathematicallyVerified:false}])
  assert.equal(rejectUntrustedVerification(result),result);
});

test('candidate provenance rejects getters, proxies and UTF-8 byte overflow',()=>{
 const accessor={...source};
 Object.defineProperty(accessor,'text',{get(){throw Error('should not execute');},enumerable:true});
 assert.throws(()=>candidateDigest(accessor),/Invalid extraction candidate/);
 assert.throws(()=>candidateDigest(new Proxy(source,{})),/Invalid extraction candidate/);
 assert.throws(()=>candidateDigest({...source,text:'🧮'.repeat(70000)}),/Invalid extraction candidate/);
});

test('candidate assessment never invokes untrusted source/status accessors',()=>{
 const candidate={source,status:'LLM_CANDIDATE'};
 Object.defineProperty(candidate,'status',{get(){throw Error('accessor executed');},enumerable:true});
 assert.throws(()=>assessKnowledge(candidate),/Invalid knowledge candidate/);
 const candidate2={source,status:'LLM_CANDIDATE'};
 Object.defineProperty(candidate2,'source',{get(){throw Error('accessor executed');},enumerable:true});
 assert.throws(()=>assessKnowledge(candidate2),/Invalid knowledge candidate/);
});

test('recursive guard never executes nested getters or proxy traps',()=>{
 const nested={};
 Object.defineProperty(nested,'status',{get(){throw Error('executed getter');},enumerable:true});
 assert.throws(()=>rejectUntrustedVerification({nested}),/Invalid knowledge result/);
 assert.throws(()=>rejectUntrustedVerification({nested:new Proxy({status:'KERNEL_VERIFIED'}, {})}),/Invalid knowledge result/);
});

test('recursive guard bounds total object traversal',()=>{
 const result={items:Array.from({length:20001},()=>({status:'LLM_CANDIDATE'}))};
 assert.throws(()=>rejectUntrustedVerification(result),/Invalid knowledge result/);
});

test('source page upper bound agrees with queue contract',()=>{
 assert.doesNotThrow(()=>candidateDigest({...source,page:1000000}));
 assert.throws(()=>candidateDigest({...source,page:1000001}),/Invalid extraction candidate/);
});
test('nested sparse arrays fail closed',()=>{
 const sparse=new Array(3);sparse[2]={status:'LLM_CANDIDATE'};
 assert.throws(()=>rejectUntrustedVerification({items:sparse}),/Invalid knowledge result/);
});

test('assessment rejects accessor options',()=>{
 const options={};
 Object.defineProperty(options,'kernelReceipt',{get(){throw Error('getter ran');},enumerable:true});
 assert.throws(()=>assessKnowledge({source,status:'LLM_CANDIDATE'},options),/Invalid knowledge options/);
});

test('aggregate result properties are bounded',()=>{
 const result={items:Array.from({length:101},()=>Object.fromEntries(Array.from({length:200},(_,i)=>['key'+i,i])))};
 assert.throws(()=>rejectUntrustedVerification(result),/Invalid knowledge result/);
});
