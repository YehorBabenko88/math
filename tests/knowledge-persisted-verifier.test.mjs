import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {OneShotKernelVerifier,createVerificationRequestV2} from '../src/knowledge/one-shot-verifier.mjs';
import {FileReplayLedger} from '../src/knowledge/file-replay-ledger.mjs';
const h=x=>'sha256:'+x.repeat(64);
const base={schema_version:'kg.verify-request.v1',requested_status:'PENDING',theorem_revision:h('a'),theorem_content_hash:h('b'),proof_revision:h('c'),proof_content_hash:h('d'),context_hash:h('e')};
const keys=generateKeyPairSync('ed25519');
const verifier=()=>new OneShotKernelVerifier({public_key_pem:keys.publicKey.export({type:'spki',format:'pem'}),kernel_id:'k',kernel_version:'1'});
const signed=req=>{
 const r={schema_version:'kg.kernel-result.v2',verdict:'PASS',kernel_id:'k',kernel_version:'1',request_id:req.request_id,theorem_revision:req.theorem_revision,theorem_content_hash:req.theorem_content_hash,proof_revision:req.proof_revision,proof_content_hash:req.proof_content_hash,context_hash:req.context_hash};
 return {...r,attestation:sign(null,Buffer.from(JSON.stringify(r)),keys.privateKey).toString('base64')};
};
test('persistent replay blocked across verifier instances',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kg-persist-'));
 try {
  const request=createVerificationRequestV2(base),result=signed(request),ledger=new FileReplayLedger(dir);
  assert.equal((await verifier().assessPersisted(request,result,ledger)).verdict,'PASS');
  await assert.rejects(verifier().assessPersisted(request,result,new FileReplayLedger(dir)),/replayed/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('invalid signature does not consume persistent request',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kg-persist-'));
 try {
  const request=createVerificationRequestV2(base),result=signed(request),ledger=new FileReplayLedger(dir);
  await assert.rejects(verifier().assessPersisted(request,{...result,verdict:'FAIL'},ledger),/untrusted/);
  assert.equal((await verifier().assessPersisted(request,result,ledger)).verdict,'PASS');
 } finally {await rm(dir,{recursive:true,force:true});}
});

test('forged ledger object is rejected',async()=>{
 const request=createVerificationRequestV2(base),result=signed(request);
 await assert.rejects(verifier().assessPersisted(request,result,{consume:async()=>true}),/trusted FileReplayLedger/);
});
