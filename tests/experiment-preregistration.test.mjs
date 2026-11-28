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
test('ordinal negative zero is refused before semantic identity',()=>assert.throws(()=>validatePreregistration({...p,ordinal:-0}),/INVALID_PREREGISTRATION|INVALID|negative|canonical/i));
import {createExperimentLedger} from '../src/experiment/postgres-ledger.mjs';
test('COMMIT transport loss remains unknown even when closing the broken connection fails',async()=>{
 let opens=0;
 const ledger=createExperimentLedger(null,{resolvePreregistration:async()=>null,resolveTerminal:async()=>false,openDedicatedConnection:async()=>{opens++;return {query:async sql=>{if(sql.startsWith('SELECT current_database'))return {rows:[{db:'math_experiment_test',role:'math_experiment_host',version:180001}]};if(sql==='COMMIT')throw Error('transport loss');return {rows:[]};},end:async()=>{throw Error('socket closed');}};}});
 await assert.rejects(ledger.lookup(r),/COMMIT_UNKNOWN/);
 assert.equal(opens,1);
});

const validToken='12345678-1234-4234-8234-123456789abc';
function boundary(commitTag){
 let opens=0,resolves=0;const queries=[];
 const ledger=createExperimentLedger(null,{resolvePreregistration:async()=>null,resolveTerminal:async()=>{resolves++;return true;},openDedicatedConnection:async()=>{opens++;return {query:async(sql,args)=>{queries.push([sql,args]);if(sql.startsWith('SELECT current_database'))return {rows:[{db:'math_experiment_test',role:'math_experiment_host',version:180001}]};if(sql==='COMMIT')return {command:commitTag};return {rows:[{fresh:true,outcome:'COMMITTED'}]};},end:async()=>{}};}});
 return {ledger,queries,opens:()=>opens,resolves:()=>resolves};
}
test('ROLLBACK command tag cannot acknowledge a fresh start',async()=>{
 const {ledger}=boundary('ROLLBACK');await assert.rejects(ledger.start(r,r,r,validToken),/COMMIT_UNKNOWN/);
});
test('missing command tag cannot acknowledge a fresh start',async()=>{
 const {ledger}=boundary(undefined);await assert.rejects(ledger.start(r,r,r,validToken),/COMMIT_UNKNOWN/);
});
test('COMMIT tag permits only deny-authority response',async()=>{
 const {ledger}=boundary('COMMIT');assert.deepEqual(await ledger.start(r,r,r,validToken),{fresh:true,executionAuthority:false});
});
test('nonprimitive or malformed UUID refuses before transport and resolver',async()=>{
 const h=boundary('COMMIT');let traps=0;
 const hostile={toString(){traps++;return validToken;}};
 const terminal={schema:'math.experiment.attempt.v1',intentRef:r,foldRef:r,ordinal:0,status:'FAILED',metricRef:null};
 for(const token of [hostile,new String(validToken),null,undefined,123,'bad',validToken+'\n']){
  await assert.rejects(h.ledger.start(r,r,r,token),/INVALID_TOKEN/);
  await assert.rejects(h.ledger.finalize(r,terminal,r,token),/INVALID_TOKEN/);
 }
 assert.equal(h.opens(),0);assert.equal(h.resolves(),0);assert.equal(traps,0);
});
