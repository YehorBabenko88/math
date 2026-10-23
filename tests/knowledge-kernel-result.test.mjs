import test from 'node:test';
import assert from 'node:assert/strict';
import {assessKernelResult} from '../src/knowledge/kernel-result-boundary.mjs';
const h=n=>'sha256:'+String(n).repeat(64);
const request={schema_version:'kg.verify-request.v1',requested_status:'PENDING',theorem_revision:h('a'),theorem_content_hash:h('b'),proof_revision:h('c'),proof_content_hash:h('d'),context_hash:h('e')};
const result={schema_version:'kg.kernel-result.v1',verdict:'PASS',kernel_id:'independent',kernel_version:'1',theorem_revision:request.theorem_revision,theorem_content_hash:request.theorem_content_hash,proof_revision:request.proof_revision,proof_content_hash:request.proof_content_hash,context_hash:request.context_hash,attestation:'opaque'};
test('result assessment requires independent authentication and never grants VERIFIED',()=>{
 assert.throws(()=>assessKernelResult(request,result),/untrusted/);
 const assessment=assessKernelResult(request,result,()=>true);
 assert.equal(assessment.verdict,'PASS');
 assert.equal(assessment.trust,'AUTHENTICATED_RESULT_ONLY');
 assert.equal('status' in assessment,false);
});
test('swapped proof or context fails even with authentic signature',()=>{
 assert.throws(()=>assessKernelResult(request,{...result,proof_revision:h('f')},()=>true),/binding mismatch/);
 assert.throws(()=>assessKernelResult(request,{...result,context_hash:h('f')},()=>true),/binding mismatch/);
});
test('unknown result fields and unsupported verdict fail closed',()=>{
 assert.throws(()=>assessKernelResult(request,{...result,status:'VERIFIED'},()=>true),/unexpected/);
 assert.throws(()=>assessKernelResult(request,{...result,verdict:'VERIFIED'},()=>true),/invalid/);
});
