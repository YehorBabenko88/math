import test from 'node:test';import assert from 'node:assert/strict';
import {verifyOidcSignature} from '../src/evidence-receiver/oidc.mjs';
import {validatePublicSummary} from '../src/confidential-collector/public-schema.mjs';
test('failure stage is fixed, public-safe and never reflects input',()=>{
 assert.throws(()=>verifyOidcSignature('secret-path-SID-token',{}),e=>e.code==='E_OIDC_HEADER'&&!e.message.includes('secret-path'));
 const p={schema:1,scope:'SYNTHETIC_HOSTED_ONLY',status:'BLOCKED',phase:'STRICT_OIDC_OR_TRANSPORT',code:'E_OIDC_SIGNATURE',nativeAcceptance:'BLOCKED',operationalAcceptance:'UNQUALIFIED',physicalG1:'BLOCKED',production:'NO_GO',bookGate:'CLOSED',q01:'OPEN'};
 assert.equal(validatePublicSummary(p),true);assert.throws(()=>validatePublicSummary({...p,code:'raw-token-value'}),/BLOCKED/);
 assert.throws(()=>validatePublicSummary({...p,token:'raw-token-value'}),/BLOCKED/);
});
