import test from 'node:test';
import assert from 'node:assert/strict';
import {correlatePinnedSource} from '../src/ai-orchestrator/source-correlation.mjs';
const commit='cb168925b5aeec0c957137dd94ab72c64f0bd333',tree='10cfd29f5d2c75e841d88dd70bef8773dada8287',hash='a'.repeat(64);
const source={repository:'YehorBabenko88/math',objectFormat:'sha1',commit,tree};
const task={schemaVersion:1,taskId:'task1',kind:'HYPOTHESIS',role:'research',sourceCommit:commit,inputs:[],budget:{wallSeconds:1,memoryMb:1,outputMb:1,llmTokens:1,attempts:1},permissions:{network:false,productionWrite:false,kernelWrite:false}};
const receipt={schemaVersion:1,taskId:'task1',attempt:1,sourceCommit:commit,inputHashes:[],outputHash:hash,toolchainHash:hash,result:'PASS',metrics:{wallSeconds:1,peakMemoryMb:1,outputMb:1,llmTokens:1}};
const claim={schemaVersion:1,taskId:'task1',sourceCommit:commit,runnerId:'runner',runnerImageHash:hash,toolchainHash:hash,receiptHash:hash,attempt:1};
test('correlation never verifies proof or publication',()=>{
 const r=correlatePinnedSource(source,task,receipt,claim);
 assert.equal(r.trust,'UNRESOLVED_OBJECT_IDS');assert.equal(r.proof,'NOT_VERIFIED');assert.equal(r.publication,'DENIED');
});
test('task source substitution rejected',()=>assert.throws(()=>correlatePinnedSource(source,{...task,sourceCommit:'b'.repeat(40)},receipt,claim),/SOURCE_COMMIT_MISMATCH/));
test('receipt source substitution rejected',()=>assert.throws(()=>correlatePinnedSource(source,task,{...receipt,sourceCommit:'b'.repeat(40)},claim),/SOURCE_COMMIT_MISMATCH/));
test('claim source substitution rejected',()=>assert.throws(()=>correlatePinnedSource(source,task,receipt,{...claim,sourceCommit:'b'.repeat(40)}),/SOURCE_COMMIT_MISMATCH/));
test('attempt substitution rejected',()=>assert.throws(()=>correlatePinnedSource(source,task,receipt,{...claim,attempt:2}),/SOURCE_ATTEMPT_MISMATCH/));
test('untrusted release request rejected',()=>assert.throws(()=>correlatePinnedSource(source,{...task,kind:'RELEASE_CANDIDATE',role:'publisher'},receipt,claim),/PUBLICATION_NOT_IMPLEMENTED/));
