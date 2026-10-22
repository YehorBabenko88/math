import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReceipt,matchReceipt,matchReceiptAndOutput} from '../src/ai-orchestrator/receipts.mjs';
const hash='a'.repeat(64),out='b'.repeat(64);
const task={taskId:'task-1',sourceCommit:hash,inputs:[{sha256:hash}],budget:{wallSeconds:600,memoryMb:1024,outputMb:50,llmTokens:20000,attempts:2}};
const receipt={schemaVersion:1,taskId:'task-1',attempt:1,sourceCommit:hash,inputHashes:[hash],outputHash:out,toolchainHash:hash,result:'PASS',metrics:{wallSeconds:1,peakMemoryMb:2,outputMb:3,llmTokens:4}};
test('receipt is never an attestation',()=>assert.equal(matchReceipt(task,receipt).trust,'SELF_REPORTED_UNATTESTED'));
test('reject forged verified',()=>assert.throws(()=>validateReceipt({...receipt,verified:true})));
test('reject source mismatch',()=>assert.throws(()=>matchReceipt(task,{...receipt,sourceCommit:out})));
test('reject input mismatch',()=>assert.throws(()=>matchReceipt(task,{...receipt,inputHashes:[out]})));
test('reject excessive output',()=>assert.throws(()=>matchReceipt(task,{...receipt,metrics:{...receipt.metrics,outputMb:51}})));
test('reject excessive attempt',()=>assert.throws(()=>matchReceipt(task,{...receipt,attempt:3})));
test('reject malformed hash',()=>assert.throws(()=>validateReceipt({...receipt,outputHash:'not-a-hash'})));
test('reject unknown result',()=>assert.throws(()=>validateReceipt({...receipt,result:'VERIFIED'})));

test('receipt and actual bytes must agree',()=>{
 const bytes=new TextEncoder().encode('sample');
 assert.throws(()=>matchReceiptAndOutput(task,receipt,bytes),/DIGEST_MISMATCH/);
});

test('matched receipt bytes remain unattested',async()=>{
 const {sha256}=await import('../src/ai-orchestrator/artifacts.mjs');
 const bytes=new TextEncoder().encode('sample');
 const result=matchReceiptAndOutput(task,{...receipt,outputHash:sha256(bytes)},bytes);
 assert.equal(result.integrity,'MATCHED');
 assert.equal(result.provenance,'UNATTESTED');
});
