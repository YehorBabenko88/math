import test from 'node:test';
import assert from 'node:assert/strict';
import {binary64Hex,semanticDigest} from '../src/math-universe-codec.mjs';
import {assessStructuralApplicability} from '../src/method-applicability.mjs';
import {buildKnowledgeGap} from '../src/knowledge/acquisition-contract.mjs';
import {quarantineHandoff} from '../src/knowledge/acquisition-intake.mjs';

// Test-only context envelope, not a new host/classifier or an attestation.
const candidate='3ac728aabd627f2090b054a85fc26c4de0cb368d';
const request=(d, times)=>({schema:'math.method.structural.request.v1',
  sampleIds:times.map(t=>`t${t}`),eventMs:times,cadenceMs:1000,
  rowsBits:times.map((_,i)=>Array.from({length:d},(_,j)=>binary64Hex(i===0?0:j===0?i:0)))});
const ref=(q,result,methodId='sphere')=>semanticDigest('draft.o.context.test.v1',{
  candidate,requestRef:semanticDigest(q.schema,q),resultRef:semanticDigest(result.schema,result),methodId});
const deny=(v)=>{for(const k of ['verified','exportAuthorized','persistAuthorized','executable'])assert.equal(v[k],false);assert.ok(Object.isFrozen(v));};
const gap=(contextHash,reason,methodId='sphere')=>buildKnowledgeGap({contextHash,reason,methodId});
const missing='MISSING_MATHEMATICAL_PREREQUISITE';
for(const d of [4,32]) test(`actual M ${d}D irregular/zero/constant structural reasons never directly map to O gap`,()=>{
  const q=request(d,[1000,3000]), result=assessStructuralApplicability(q);
  assert.equal(result.facts.dimension,d);assert.equal(result.facts.gapCount,1);
  assert.equal(result.executionAuthority,false);assert.equal(result.tradingAuthorized,false);
  const reasons=new Set(result.domains.flatMap(v=>v.reasons));
  assert.deepEqual([...reasons].sort(),['ZERO_DIRECTION','IRREGULAR_CADENCE','CONSTANT_COLUMNS','ESTIMATOR_REQUIRED','GRAPH_REQUIRED','METRIC_REQUIRED','MANIFOLD_ASSUMPTIONS_REQUIRED'].sort());
  for(const reason of reasons)assert.throws(()=>gap(ref(q,result),reason),/INVALID_GAP/);
});
test('actual M regular two-observation dynamics prerequisite is insufficient support, not missing knowledge',()=>{
  const q=request(32,[1000,2000]), result=assessStructuralApplicability(q);
  const dyn=result.domains.find(v=>v.domain==='DYNAMICS');
  assert.equal(dyn.status,'PENDING_PREREQUISITE');assert.deepEqual(dyn.reasons,['INSUFFICIENT_SAMPLE_SUPPORT']);
  assert.throws(()=>gap(ref(q,result,'dynamics'),dyn.reasons[0],'dynamics'),/INVALID_GAP/);
});
test('test-only canonical context binds request, observed result and method; no attestation',()=>{
  const q=request(4,[1000,2000]),result=assessStructuralApplicability(q), h=ref(q,result);
  assert.equal(h,ref(Object.fromEntries(Object.entries(q).reverse()),result));
  const changed=request(4,[1000,3000]);
  assert.notEqual(h,ref(changed,assessStructuralApplicability(changed)));
  assert.notEqual(h,ref(q,{...result,facts:{...result.facts,gapCount:1}}));
  assert.notEqual(h,ref(q,result,'acf'));
  const claim=gap(h,missing);assert.equal(claim.contextHash,h);assert.equal(claim.status,'ABSTAIN');deny(claim);
});
test('self-asserted gap over actual refused M result remains an unverified draft even with exact digest',()=>{
  const q=request(4,[1000,3000]),result=assessStructuralApplicability(q);
  assert.equal(result.domains.find(v=>v.domain==='SPHERICAL').status,'REFUSED');
  const contextHash=ref(q,result), claim=gap(contextHash,missing);
  deny(claim);assert.equal(claim.status,'ABSTAIN');
  assert.throws(()=>buildKnowledgeGap({contextHash,methodId:'sphere',reason:missing,independentReceipt:contextHash}),/INVALID_FIELDS/);
});
test('handoff associated with real M context remains quarantine, even when artifact hash equals context hash',()=>{
  const q=request(32,[1000,2000]), result=assessStructuralApplicability(q), contextHash=ref(q,result);
  const handoff=quarantineHandoff({contextHash,artifactHash:contextHash,origin:'CHATGPT'});
  assert.equal(handoff.status,'QUARANTINED');assert.equal(handoff.rights,'UNKNOWN');deny(handoff);
  assert.throws(()=>quarantineHandoff({contextHash,artifactHash:contextHash,origin:'CHATGPT',source_authenticity:'VERIFIED'}),/INVALID_FIELDS/);
});
