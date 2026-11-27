import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePreregistration} from '../src/experiment/preregistration-contract.mjs';
import {registerAttempt} from '../src/experiment/trial-ledger.mjs';
const r='a'.repeat(64);
const p={schema:'math.experiment.preregistration.v1',ordinal:0,intentRef:r,foldRef:r,manifestRef:r,cohortRef:r,inputRef:r,seedRef:r,budgetPolicyRef:r,snapshotRef:r,fitRef:r,availabilityRef:r};
test('identity compatible with terminal DTO',()=>assert.equal(validatePreregistration(p).attemptRef,registerAttempt({schema:'math.experiment.attempt.v1',intentRef:r,foldRef:r,ordinal:0,status:'FAILED',metricRef:null}).attemptRef));
test('changed binding changes prereg not attempt identity',()=>{const a=validatePreregistration(p),b=validatePreregistration({...p,availabilityRef:'b'.repeat(64)});assert.equal(a.attemptRef,b.attemptRef);assert.notEqual(a.preregRef,b.preregRef);});
test('holdout refused',()=>assert.throws(()=>validatePreregistration({...p,holdoutRef:r})));
test('unsafe ordinal refused',()=>assert.throws(()=>validatePreregistration({...p,ordinal:2**53})));

import {semanticTrialBinding} from '../src/experiment/preregistration-contract.mjs';
import {semanticDigest} from '../src/math-universe-codec.mjs';
import {enumerateDiscovery} from '../src/discovery-search.mjs';
test('J roster reorder does not create a new semantic trial',()=>{
 const b='b'.repeat(64);
 const req={schema:'math.discovery.request.v1',developmentRef:r,policyRef:r,catalogRef:r,methodRefs:[r,b],portStateRefs:[r],maxIntents:2};
 const x=enumerateDiscovery(req)[1],y=enumerateDiscovery({...req,methodRefs:[b]})[0];
 const px={...p,intentRef:semanticDigest(x.schema,x)},py={...p,intentRef:semanticDigest(y.schema,y)};
 assert.notEqual(px.intentRef,py.intentRef);
 assert.equal(semanticTrialBinding(px,x).semanticRef,semanticTrialBinding(py,y).semanticRef);
 assert.notEqual(semanticTrialBinding({...py,availabilityRef:b},y).semanticRef,semanticTrialBinding(py,y).semanticRef);
 assert.throws(()=>semanticTrialBinding(px,y),/INTENT_BINDING_MISMATCH/);
});
