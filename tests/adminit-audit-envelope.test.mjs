import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {unseal} from '../src/evidence-receiver/seal.mjs';
import {sealAuditEvidence} from '../scripts/adminit-containment/seal-audit.mjs';
test('original native evidence roundtrips privately and rejects tampering',()=>{
 const k=generateKeyPairSync('rsa',{modulusLength:3072});
 const p={sourceHead:'a'.repeat(40),sourceTree:'b'.repeat(40),runId:'123',attempt:'1',files:{'results.json':'private SID and process handles'}};
 const bytes=sealAuditEvidence(p,k.publicKey);assert.ok(!bytes.includes(Buffer.from('private SID')));
 assert.equal(JSON.stringify(unseal(bytes,k.privateKey)),JSON.stringify(p));
 const corrupt=JSON.parse(bytes);corrupt.tag='A'.repeat(22);
 assert.throws(()=>unseal(Buffer.from(JSON.stringify(corrupt)),k.privateKey));
});
