import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePublicSummary} from '../src/confidential-collector/public-schema.mjs';

const blocked=Object.freeze({
 schema:1,scope:'SYNTHETIC_HOSTED_ONLY',status:'BLOCKED',
 phase:'STRICT_OIDC_OR_TRANSPORT',nativeAcceptance:'BLOCKED',
 operationalAcceptance:'UNQUALIFIED',physicalG1:'BLOCKED',
 production:'NO_GO',bookGate:'CLOSED',q01:'OPEN'
});

test('PR64 failure-only public projection remains blocked and non-authoritative',()=>{
 assert.equal(validatePublicSummary({...blocked}),true);
 for(const [field,value] of Object.entries({
  nativeAcceptance:'PASS',operationalAcceptance:'QUALIFIED',
  physicalG1:'PASS',production:'GO',bookGate:'OPEN',q01:'CLOSED',
  token:'raw-bearer',stack:'at private path',jobId:'123',receiptSignature:'forged'
 })){
  assert.throws(()=>validatePublicSummary({...blocked,[field]:value}),/BLOCKED/);
 }
});

test('PR64 collector failure code is fixed, not arbitrary error text',()=>{
 for(const phase of ['AUTHENTICATION_FAILED:token','/home/runner/private','STRICT_OIDC_OR_TRANSPORT\nstack']){
  assert.throws(()=>validatePublicSummary({...blocked,phase}),/BLOCKED/);
 }
});

test('public failure cannot be mistaken for success evidence',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/confidential-collector.yml',import.meta.url),'utf8');
 assert.match(workflow,/PINNED_SYNTHETIC_QUALIFICATION_BLOCKED/);
 assert.match(workflow,/process\.exitCode=child\.status===0\?0:1/);
 assert.match(workflow,/if: always\(\) && steps\.collect\.outputs\.safe_public == 'true'/);
 assert.match(workflow,/if-no-files-found: error/);
 assert.match(workflow,/retention-days: 14/);
});
