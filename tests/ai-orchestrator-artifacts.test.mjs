import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,verifyArtifact,verifyReceiptOutput} from '../src/ai-orchestrator/artifacts.mjs';
const bytes=new TextEncoder().encode('untrusted artifact');
const digest=sha256(bytes);
test('matches bytes but does not attest provenance',()=>{
 const result=verifyArtifact(bytes,digest);
 assert.equal(result.integrity,'MATCHED');
 assert.equal(result.provenance,'UNATTESTED');
});
test('reject modified bytes',()=>assert.throws(()=>verifyArtifact(new TextEncoder().encode('modified'),digest)));
test('reject invalid digest',()=>assert.throws(()=>verifyArtifact(bytes,'HEAD')));
test('reject non-byte inputs',()=>assert.throws(()=>sha256('text')));
test('receipt output hash is checked against actual bytes',()=>assert.equal(verifyReceiptOutput({outputHash:digest},bytes).sha256,digest));
test('receipt hash mismatch fails',()=>assert.throws(()=>verifyReceiptOutput({outputHash:'a'.repeat(64)},bytes)));
