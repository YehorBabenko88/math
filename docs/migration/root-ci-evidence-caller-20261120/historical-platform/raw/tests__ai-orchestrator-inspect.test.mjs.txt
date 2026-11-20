import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../src/ai-orchestrator/artifacts.mjs';
import {newReplayFilter} from '../src/ai-orchestrator/replay.mjs';
import {inspectOfflineEvidence} from '../src/ai-orchestrator/inspect.mjs';
const hash='a'.repeat(64), bytes=new TextEncoder().encode('result');
const task={schemaVersion:1,taskId:'job1',kind:'ADAPTER_BUILD',role:'codex',sourceCommit:hash,inputs:[],budget:{wallSeconds:10,memoryMb:100,outputMb:1,llmTokens:10,attempts:1},permissions:{network:false,productionWrite:false,kernelWrite:false}};
const receipt={schemaVersion:1,taskId:'job1',attempt:1,sourceCommit:hash,inputHashes:[],outputHash:sha256(bytes),toolchainHash:hash,result:'PASS',metrics:{wallSeconds:1,peakMemoryMb:1,outputMb:1,llmTokens:1}};
const receiptBytes=new TextEncoder().encode(JSON.stringify(receipt));
const claim={schemaVersion:1,taskId:'job1',sourceCommit:hash,runnerId:'runner1',runnerImageHash:hash,toolchainHash:hash,receiptHash:sha256(receiptBytes),attempt:1};
const args={task,receipt,receiptBytes,outputBytes:bytes,claim,replayFilter:newReplayFilter()};
test('combined evidence never becomes VERIFIED or published',()=>{
 const r=inspectOfflineEvidence(args);
 assert.equal(r.integrity,'MATCHED');assert.equal(r.identity,'UNATTESTED_CLAIM');
 assert.equal(r.proof,'NOT_VERIFIED');assert.equal(r.publication,'DENIED');
});
test('repeated attempt rejected using returned filter',()=>{
 const first=inspectOfflineEvidence(args);
 assert.throws(()=>inspectOfflineEvidence({...args,replayFilter:first.nextReplayFilter}),/REPLAY_DETECTED/);
});
test('mismatched output cannot register attempt',()=>{
 assert.throws(()=>inspectOfflineEvidence({...args,outputBytes:new Uint8Array([0])}),/DIGEST_MISMATCH/);
 assert.equal(args.replayFilter.entries.length,0);
});
test('changed receipt bytes rejected before replay',()=>{
 assert.throws(()=>inspectOfflineEvidence({...args,receiptBytes:new TextEncoder().encode('{}')}),/RECEIPT_HASH_MISMATCH/);
});
test('caller cannot request release task',()=>{
 assert.throws(()=>inspectOfflineEvidence({...args,task:{...task,kind:'RELEASE_CANDIDATE',role:'publisher'}}),/PUBLICATION_NOT_IMPLEMENTED/);
});
