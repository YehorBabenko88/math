import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../src/ai-orchestrator/artifacts.mjs';
import {verifyArtifactStream} from '../src/ai-orchestrator/stream.mjs';
const enc=new TextEncoder(),one=enc.encode('hello'),two=enc.encode('world');
const digest=sha256(enc.encode('helloworld'));
async function* chunks(){yield one;yield two;}
test('stream hashes actual chunks with bounded count',async()=>{
 const r=await verifyArtifactStream(chunks(),digest,{maxBytes:10});
 assert.equal(r.bytes,10);assert.equal(r.provenance,'UNATTESTED');
});
test('over budget stops without reading next chunk',async()=>{
 let advanced=false;
 async function* source(){yield one;yield two;advanced=true;yield one;}
 await assert.rejects(verifyArtifactStream(source(),digest,{maxBytes:9}),/ACTUAL_OUTPUT_BUDGET_EXCEEDED/);
 assert.equal(advanced,false);
});
test('digest mismatch rejected',async()=>assert.rejects(verifyArtifactStream(chunks(),'a'.repeat(64),{maxBytes:10}),/DIGEST_MISMATCH/));
test('invalid chunk rejected',async()=>{
 async function* bad(){yield 'text';}
 await assert.rejects(verifyArtifactStream(bad(),digest,{maxBytes:10}),/INVALID_CHUNK/);
});
test('invalid limit rejected',async()=>assert.rejects(verifyArtifactStream(chunks(),digest,{maxBytes:-1}),/INVALID_LIMIT/));
test('zero byte stream accepted with correct hash',async()=>{
 async function* empty(){}
 assert.equal((await verifyArtifactStream(empty(),sha256(new Uint8Array()),{maxBytes:0})).bytes,0);
});
