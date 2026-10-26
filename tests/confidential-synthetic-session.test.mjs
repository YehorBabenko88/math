import test from'node:test';import assert from'node:assert/strict';import{mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{createHash,createPublicKey,generateKeyPairSync,sign}from'node:crypto';import{collectorFixture}from'./fixtures/confidential-collector/context.mjs';import{buildSyntheticBundle}from'../src/confidential-collector/synthetic-bundle.mjs';import{seal}from'../src/evidence-receiver/seal.mjs';import{ReceiverJournal}from'../src/evidence-receiver/journal.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('synthetic encrypted session validates real-shaped issuer proof, rejects replay/mismatches and never grants native acceptance',async t=>{const{SyntheticSession,verifySyntheticReceipt,publicProjection}=await import('../src/confidential-collector/session.mjs');const f=collectorFixture(),dir=mkdtempSync(join(tmpdir(),'synthetic-session-only-')),journal=new ReceiverJournal(join(dir,'vault.db'));t.after(()=>{journal.close();rmSync(dir,{recursive:true,force:true});});const s=new SyntheticSession({journal,context:f.context,policy:f.policy,collectorSha:f.collectorSha,approvedSubjects:f.subjects,jwksProvider:async()=>f.jwks,platformReader:async()=>f.platform,clock:()=>f.now});const d=s.describe();assert.deepEqual(Object.keys(d).sort(),['challenge','receiptPublicKey','recipientPublicKey']);const zip=buildSyntheticBundle(Object.fromEntries(['sourceHead','sourceTree','runId','attempt','jobId'].map(k=>[k,d.challenge[k]])),'9'.repeat(64));const message={scope:'SYNTHETIC_TRANSPORT_ONLY',nonce:d.challenge.nonce,token:f.token(d.challenge),zipSha256:sha(zip),zipBase64:zip.toString('base64')};const bytes=seal(message,createPublicKey(d.recipientPublicKey));assert.doesNotMatch(bytes.toString(),/fixture-token|SYNTHETIC_REQUEST/);const r=await s.receive(bytes,sha(bytes));assert.equal(verifySyntheticReceipt(r,createPublicKey(d.receiptPublicKey)).nativeAcceptance,'BLOCKED');const negatives=await s.exerciseRejections();assert.ok(negatives.length>=8);const p=publicProjection(r.receipt,f.collectorSha,negatives.length);assert.equal(p.operationalAcceptance,'UNQUALIFIED');assert.doesNotMatch(JSON.stringify(p),/token|canary|privateKey|userSid|createdFileTime/);await assert.rejects(()=>s.receive(bytes,sha(bytes)),/BLOCKED/);});

test('signed synthetic receipt cannot self-assert operational authority',async()=>{
 const {verifySyntheticReceipt}=await import('../src/confidential-collector/session.mjs');
 const {keyId}=await import('../src/evidence-receiver/seal.mjs');
 const keys=generateKeyPairSync('ed25519');
 const receipt={scope:'SYNTHETIC_TRANSPORT_ONLY',sourceHead:'a'.repeat(40),sourceTree:'b'.repeat(40),runId:'1',attempt:'1',jobId:'2',zipSha256:'c'.repeat(64),runHead:'d'.repeat(40),baseHead:'e'.repeat(40),workflowSha:'f'.repeat(40),status:'SYNTHETIC_STORED_PENDING_REVIEW',checkRunId:'3',nativeAcceptance:'BLOCKED',operationalAcceptance:'UNQUALIFIED',physicalG1:'BLOCKED',production:'NO_GO',bookGate:'CLOSED',q01:'OPEN'};
 const signed=receipt=>({receipt,signerKeyId:keyId(keys.publicKey),signature:sign(null,Buffer.from(JSON.stringify(receipt)),keys.privateKey).toString('base64url')});
 assert.equal(verifySyntheticReceipt(signed(receipt),keys.publicKey).q01,'OPEN');
 for(const [field,value] of [['verified',true],['Execute',true],['ownerApproved',true],['q01','CLOSED'],['bookGate','OPEN']])
  assert.throws(()=>verifySyntheticReceipt(signed({...receipt,[field]:value}),keys.publicKey),/BLOCKED/);
});

test('independently pinned synthetic receipt identity rejects stale run/job and digest',async()=>{
 const {verifyBoundSyntheticReceipt}=await import('../src/confidential-collector/session.mjs');
 const {keyId}=await import('../src/evidence-receiver/seal.mjs');
 const keys=generateKeyPairSync('ed25519');
 const expected={sourceHead:'a'.repeat(40),sourceTree:'b'.repeat(40),runHead:'c'.repeat(40),baseHead:'d'.repeat(40),workflowSha:'e'.repeat(40),runId:'11',attempt:'1',jobId:'22',checkRunId:'33',zipSha256:'f'.repeat(64)};
 const receipt={scope:'SYNTHETIC_TRANSPORT_ONLY',...expected,status:'SYNTHETIC_STORED_PENDING_REVIEW',nativeAcceptance:'BLOCKED',operationalAcceptance:'UNQUALIFIED',physicalG1:'BLOCKED',production:'NO_GO',bookGate:'CLOSED',q01:'OPEN'};
 const signed={receipt,signerKeyId:keyId(keys.publicKey),signature:sign(null,Buffer.from(JSON.stringify(receipt)),keys.privateKey).toString('base64url')};
 assert.equal(verifyBoundSyntheticReceipt(signed,keys.publicKey,expected).execution,'DENIED');
 for(const [field,value] of [['sourceHead','0'.repeat(40)],['runId','12'],['attempt','2'],['jobId','23'],['checkRunId','34'],['zipSha256','0'.repeat(64)]]){
  assert.throws(()=>verifyBoundSyntheticReceipt(signed,keys.publicKey,{...expected,[field]:value}),/BLOCKED/);
 }
 assert.throws(()=>verifyBoundSyntheticReceipt(signed,keys.publicKey,{...expected,approved:true}),/BLOCKED/);
});

test('verified synthetic receipt is frozen against post-verification mutation',async()=>{
 const {verifySyntheticReceipt}=await import('../src/confidential-collector/session.mjs');
 const {keyId}=await import('../src/evidence-receiver/seal.mjs');
 const keys=generateKeyPairSync('ed25519');
 const receipt={scope:'SYNTHETIC_TRANSPORT_ONLY',sourceHead:'a'.repeat(40),sourceTree:'b'.repeat(40),runId:'1',attempt:'1',jobId:'2',zipSha256:'c'.repeat(64),runHead:'d'.repeat(40),baseHead:'e'.repeat(40),workflowSha:'f'.repeat(40),status:'SYNTHETIC_STORED_PENDING_REVIEW',checkRunId:'3',nativeAcceptance:'BLOCKED',operationalAcceptance:'UNQUALIFIED',physicalG1:'BLOCKED',production:'NO_GO',bookGate:'CLOSED',q01:'OPEN'};
 const signed={receipt,signerKeyId:keyId(keys.publicKey),signature:sign(null,Buffer.from(JSON.stringify(receipt)),keys.privateKey).toString('base64url')};
 const checked=verifySyntheticReceipt(signed,keys.publicKey);
 assert.equal(Object.isFrozen(checked),true);
 assert.throws(()=>{checked.q01='CLOSED';},TypeError);
});
