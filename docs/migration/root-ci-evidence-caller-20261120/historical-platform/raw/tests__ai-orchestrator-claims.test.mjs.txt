import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExecutionClaim,correlateExecutionClaim,correlateExecutionClaimWithReceiptBytes} from '../src/ai-orchestrator/claims.mjs';
const a='a'.repeat(64),b='b'.repeat(64);
const claim={schemaVersion:1,taskId:'task-1',sourceCommit:a,runnerId:'offline-runner',runnerImageHash:b,toolchainHash:a,receiptHash:b,attempt:1};
const task={taskId:'task-1',sourceCommit:a};
const receipt={taskId:'task-1',sourceCommit:a,attempt:1,toolchainHash:a};
test('matching metadata never authenticates executor',()=>assert.equal(correlateExecutionClaim(task,receipt,claim).trust,'UNATTESTED_CLAIM'));
test('reject claimed VERIFIED status',()=>assert.throws(()=>validateExecutionClaim({...claim,verified:true})));
test('reject different task',()=>assert.throws(()=>correlateExecutionClaim(task,receipt,{...claim,taskId:'other'})));
test('reject source drift',()=>assert.throws(()=>correlateExecutionClaim(task,receipt,{...claim,sourceCommit:b})));
test('reject toolchain mismatch',()=>assert.throws(()=>correlateExecutionClaim(task,receipt,{...claim,toolchainHash:b})));
test('reject attempt mismatch',()=>assert.throws(()=>correlateExecutionClaim(task,receipt,{...claim,attempt:2})));
test('reject malformed runner identity',()=>assert.throws(()=>validateExecutionClaim({...claim,runnerId:'../runner'})));

test('claim receipt hash is checked against actual bytes',async()=>{
 const {sha256}=await import('../src/ai-orchestrator/artifacts.mjs');
 const bytes=new TextEncoder().encode(JSON.stringify(receipt));
 const bound={...claim,receiptHash:sha256(bytes)};
 assert.equal(correlateExecutionClaimWithReceiptBytes(task,receipt,bound,bytes).trust,'UNATTESTED_CLAIM');
 assert.throws(()=>correlateExecutionClaimWithReceiptBytes(task,receipt,claim,bytes),/RECEIPT_HASH_MISMATCH/);
});
test('same claim hash cannot bind different receipt object',async()=>{
 const {sha256}=await import('../src/ai-orchestrator/artifacts.mjs');
 const bytes=new TextEncoder().encode(JSON.stringify(receipt));
 const bound={...claim,receiptHash:sha256(bytes)};
 assert.throws(()=>correlateExecutionClaimWithReceiptBytes(task,{...receipt,extra:true},bound,bytes),/RECEIPT_BYTES_MISMATCH/);
});
test('invalid receipt bytes are rejected',async()=>{
 const {sha256}=await import('../src/ai-orchestrator/artifacts.mjs');
 const bytes=new Uint8Array([0xff]);
 const bound={...claim,receiptHash:sha256(bytes)};
 assert.throws(()=>correlateExecutionClaimWithReceiptBytes(task,receipt,bound,bytes),/INVALID_RECEIPT_BYTES/);
});
