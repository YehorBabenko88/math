import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOrchestratorEvidence} from '../src/ai-orchestrator/trust-gate.mjs';
const evidence={source:{verified:true},receipt:{result:'PASS'},runner:{signed:true},kernel:{verdict:'PASS'}};
test('self-asserted evidence never authorizes publication',()=>{
 const r=assessOrchestratorEvidence(evidence);
 assert.equal(r.publication,'DENIED');assert.equal(r.kernel,'NOT_INDEPENDENTLY_VERIFIED');
});
test('extra owner approval field rejected',()=>assert.throws(()=>assessOrchestratorEvidence({...evidence,ownerApproved:true}),/INVALID_EVIDENCE/));
test('missing kernel rejected',()=>assert.throws(()=>assessOrchestratorEvidence({source:{},receipt:{},runner:{}}),/INVALID_EVIDENCE/));
test('symbol trust field rejected',()=>assert.throws(()=>assessOrchestratorEvidence({...evidence,[Symbol('verified')]:true}),/INVALID_EVIDENCE/));
test('accessor trust field rejected without evaluation',()=>{
 let invoked=false;
 const x={...evidence};Object.defineProperty(x,'kernel',{enumerable:true,get(){invoked=true;return evidence.kernel;}});
 assert.throws(()=>assessOrchestratorEvidence(x),/INVALID_EVIDENCE/);
 assert.equal(invoked,false);
});
