import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createEd25519KernelAuthenticator} from '../src/knowledge/kernel-authenticator.mjs';
import {assessKernelResult} from '../src/knowledge/kernel-result-boundary.mjs';
const h=n=>'sha256:'+n.repeat(64);
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const auth=createEd25519KernelAuthenticator({kernel_id:'trusted',kernel_version:'1',public_key_pem:publicKey.export({type:'spki',format:'pem'})});
const request={schema_version:'kg.verify-request.v1',requested_status:'PENDING',theorem_revision:h('a'),theorem_content_hash:h('b'),proof_revision:h('c'),proof_content_hash:h('d'),context_hash:h('e')};
const result={schema_version:'kg.kernel-result.v1',verdict:'PASS',kernel_id:'trusted',kernel_version:'1',theorem_revision:request.theorem_revision,theorem_content_hash:request.theorem_content_hash,proof_revision:request.proof_revision,proof_content_hash:request.proof_content_hash,context_hash:request.context_hash};
const signed=r=>({...r,attestation:sign(null,Buffer.from(JSON.stringify(r)),privateKey).toString('base64')});
test('pinned kernel signature accepted but no VERIFIED promotion',()=>{
 const assessment=assessKernelResult(request,signed(result),auth);
 assert.equal(assessment.verdict,'PASS');
 assert.equal('status' in assessment,false);
});
test('tampering, kernel version mismatch and malformed signature fail',()=>{
 const original=signed(result);
 assert.throws(()=>assessKernelResult(request,{...original,verdict:'FAIL'},auth),/untrusted/);
 assert.throws(()=>assessKernelResult(request,{...original,kernel_version:'2'},auth),/untrusted/);
 assert.throws(()=>assessKernelResult(request,{...original,attestation:'invalid'},auth),/untrusted/);
});
test('signed result cannot change theorem identity between binding and authentication',()=>{
 const other={...request,theorem_revision:h('f')},hostile=signed(result);let reads=0;
 Object.defineProperty(hostile,'theorem_revision',{enumerable:true,get(){return ++reads===1?other.theorem_revision:request.theorem_revision;}});
 assert.throws(()=>assessKernelResult(other,hostile,auth),/inert data/);
 assert.equal(reads,0);
});
test('kernel result rejects request and result proxies without invoking traps',()=>{
 for(const target of ['request','result']){let calls=0;const proxy=new Proxy(target==='request'?request:signed(result),{get(){calls++;throw Error('trap called');},getPrototypeOf(){calls++;throw Error('trap called');}});
 assert.throws(()=>assessKernelResult(target==='request'?proxy:request,target==='result'?proxy:signed(result),auth),/inert data/);assert.equal(calls,0);}
});
test('authenticator sees frozen retained result rather than caller-owned input',()=>{
 const original=signed(result);let frozen=false;
 const assessment=assessKernelResult(request,original,value=>{frozen=Object.isFrozen(value);return auth(value);});
 assert.equal(frozen,true);assert.equal(assessment.theorem_revision,request.theorem_revision);
});
