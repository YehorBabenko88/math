import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FileReplayLedger} from '../src/knowledge/file-replay-ledger.mjs';
import {createVerificationRequestV2,OneShotKernelVerifier} from '../src/knowledge/one-shot-verifier.mjs';
const h=x=>'sha256:'+x.repeat(64);
const base={schema_version:'kg.verify-request.v1',requested_status:'PENDING',theorem_revision:h('a'),theorem_content_hash:h('b'),proof_revision:h('c'),proof_content_hash:h('d'),context_hash:h('e')};
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const verifier=ledger=>new OneShotKernelVerifier({ledger,public_key_pem:publicKey.export({type:'spki',format:'pem'}),kernel_id:'kernel',kernel_version:'1'});
const signed=req=>{
 const result={schema_version:'kg.kernel-result.v2',verdict:'PASS',kernel_id:'kernel',kernel_version:'1',request_id:req.request_id,theorem_revision:req.theorem_revision,theorem_content_hash:req.theorem_content_hash,proof_revision:req.proof_revision,proof_content_hash:req.proof_content_hash,context_hash:req.context_hash};
 return {...result,attestation:sign(null,Buffer.from(JSON.stringify(result)),privateKey).toString('base64')};
};
test('unique request IDs and single-use signed result',async()=>{
 const a=createVerificationRequestV2(base),b=createVerificationRequestV2(base);
 assert.notEqual(a.request_id,b.request_id);
 const dir=await mkdtemp(join(tmpdir(),'kg-oneshot-'));
 try {
  const ledger=new FileReplayLedger(dir),v=verifier(ledger),r=signed(a);
  assert.equal((await v.assessPersisted(a,r )).verdict,'PASS');
  await assert.rejects(v.assessPersisted(a,r ),/replayed/);
  await assert.rejects(v.assessPersisted(b,r ),/binding mismatch/);
  assert.throws(()=>v.assess(a,r),/persistent ledger required/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('tampered verdict and proof fail closed',async()=>{
 const req=createVerificationRequestV2(base),r=signed(req);
 const dir=await mkdtemp(join(tmpdir(),'kg-oneshot-'));
 try {
  const ledger=new FileReplayLedger(dir),v=verifier(ledger);
  await assert.rejects(v.assessPersisted(req,{...r,verdict:'FAIL'} ),/untrusted/);
  await assert.rejects(v.assessPersisted(req,{...r,proof_revision:h('f')} ),/binding mismatch/);
  assert.equal((await v.assessPersisted(req,r )).trust,'AUTHENTICATED_RESULT_ONLY');
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('v2 snapshots active request and result before any ledger operation',async()=>{
 for(const field of ['request','result']){const request=createVerificationRequestV2(base),result=signed(request);let reads=0;
 const active={...(field==='request'?request:result)};Object.defineProperty(active,'schema_version',{enumerable:true,get(){reads++;throw Error('getter called');}});
 const v=verifier(new FileReplayLedger('unused-no-ledger-operation'));
 await assert.rejects(v.assessPersisted(field==='request'?active:request,field==='result'?active:result),/inert data/);assert.equal(reads,0);}
});

test('v2 request rejects unbound extra fields',()=>{
 assert.throws(()=>createVerificationRequestV2({...base,admin_override:true}),/unexpected request field/);
});
test('signed result cannot authorize a request with extra unsigned fields',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kg-v2-extras-'));
 try{
  const ledger=new FileReplayLedger(dir),v=verifier(ledger),req=createVerificationRequestV2(base),result=signed(req);
  await assert.rejects(v.assessPersisted({...req,requested_status:'PENDING',admin_override:true},result),/unexpected request field/);
  assert.equal((await v.assessPersisted(req,result)).verdict,'PASS');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('verifier constructor does not invoke hostile configuration getter',()=>{
 let invoked=0;
 const config={kernel_id:'kernel',kernel_version:'1',public_key_pem:publicKey.export({type:'spki',format:'pem'})};
 Object.defineProperty(config,'ledger',{enumerable:true,get(){invoked++;throw Error('getter ran');}});
 assert.throws(()=>new OneShotKernelVerifier(config),/invalid trust policy/);
 assert.equal(invoked,0);
});

test('verifier constructor rejects Proxy without triggering traps',()=>{
 let reads=0;
 const proxy=new Proxy({ledger:null},{get(){reads++;throw Error('trap');}});
 assert.throws(()=>new OneShotKernelVerifier(proxy),/invalid trust policy/);
 assert.equal(reads,0);
});
