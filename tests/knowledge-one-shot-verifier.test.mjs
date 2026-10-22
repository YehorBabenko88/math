import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createVerificationRequestV2,OneShotKernelVerifier} from '../src/knowledge/one-shot-verifier.mjs';
const h=x=>'sha256:'+x.repeat(64);
const base={schema_version:'kg.verify-request.v1',requested_status:'PENDING',theorem_revision:h('a'),theorem_content_hash:h('b'),proof_revision:h('c'),proof_content_hash:h('d'),context_hash:h('e')};
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const verifier=()=>new OneShotKernelVerifier({public_key_pem:publicKey.export({type:'spki',format:'pem'}),kernel_id:'kernel',kernel_version:'1'});
const signed=req=>{
 const result={schema_version:'kg.kernel-result.v2',verdict:'PASS',kernel_id:'kernel',kernel_version:'1',request_id:req.request_id,theorem_revision:req.theorem_revision,theorem_content_hash:req.theorem_content_hash,proof_revision:req.proof_revision,proof_content_hash:req.proof_content_hash,context_hash:req.context_hash};
 return {...result,attestation:sign(null,Buffer.from(JSON.stringify(result)),privateKey).toString('base64')};
};
test('unique request IDs and single-use signed result',()=>{
 const a=createVerificationRequestV2(base),b=createVerificationRequestV2(base);
 assert.notEqual(a.request_id,b.request_id);
 const v=verifier(),r=signed(a);
 assert.equal(v.assess(a,r).verdict,'PASS');
 assert.throws(()=>v.assess(a,r),/replayed/);
 assert.throws(()=>v.assess(b,r),/binding mismatch/);
});
test('tampered verdict and proof fail closed',()=>{
 const req=createVerificationRequestV2(base),r=signed(req),v=verifier();
 assert.throws(()=>v.assess(req,{...r,verdict:'FAIL'}),/untrusted/);
 assert.throws(()=>v.assess(req,{...r,proof_revision:h('f')}),/binding mismatch/);
 assert.equal(v.assess(req,r).trust,'AUTHENTICATED_RESULT_ONLY');
});
