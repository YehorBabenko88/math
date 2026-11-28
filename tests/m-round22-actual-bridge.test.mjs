import test from 'node:test';
import assert from 'node:assert/strict';
import {runResearchBridge} from '../src/math-universe-research-bridge.mjs';
import {binary64Hex,decodeBinary64Hex} from '../src/math-universe-codec.mjs';
const request=(d,n=3,values=(i,j)=>i+j+1)=>({schema:'math.universe.research.request.v1',start_ms:1000,end_ms:(n+1)*1000,as_of_ms:(n+2)*1000,cadence_ms:1000,roster:Array.from({length:d},(_,j)=>`f${j}`),rows:Array.from({length:n},(_,i)=>Array.from({length:d},(_,j)=>({series:`f${j}`,epoch:'m-r22',end_ms:2000+1000*i,available_ms:2001+1000*i,revision:0,value_bits:binary64Hex(values(i,j))}))).flat()});
const domain=(r,d)=>r.applicability.domains.find(x=>x.domain===d);
const number=x=>decodeBinary64Hex(x.binary64);
const noAuthority=r=>{assert.equal(r.status,'ABSTAIN');assert.equal(r.execution_authority,false);assert.equal(r.trading_authorized,false);assert.equal(r.source_authenticity,'UNATTESTED');assert.equal(r.research.qualified,false);assert.equal(r.research.authority,'NONE');if(r.applicability){assert.equal(r.applicability.executionAuthority,false);assert.equal(r.applicability.tradingAuthorized,false);}};
for(const d of [4,32]){
 test(`${d}D actual orthogonal axes: pi/2 arcs, sqrt(2) distances, no method authority`,async()=>{
   const r=await runResearchBridge(request(d,3,(i,j)=>i===j?1:0));noAuthority(r);
   assert.equal(r.applicability.facts.dimension,d);assert.equal(domain(r,'SPHERICAL').status,'CANDIDATE');
   assert.deepEqual(r.research.geometry.trajectory.angles.map(number),[Math.PI/2,Math.PI/2]);
   assert.deepEqual(r.research.diagnostics.geometry.pairwise_distances.map(number),[Math.SQRT2,Math.SQRT2,Math.SQRT2]);
   assert.equal(r.research.diagnostics.geometry.forest.edges.length,2);
   assert.equal(domain(r,'MANIFOLD').status,'PENDING_PREREQUISITE');assert.equal(domain(r,'DISTRIBUTION').status,'PENDING_PREREQUISITE');
   assert.equal(domain(r,'STATISTICS').status,'PENDING_PREREQUISITE');
 });
 test(`${d}D zero vector: real E refusal must not promote M sphere`,async()=>{
   const r=await runResearchBridge(request(d,3,(i,j)=>i===0?0:i+j+1));noAuthority(r);
   assert.deepEqual(r.applicability.facts.zeroRowIds,['2000']);assert.equal(domain(r,'SPHERICAL').status,'REFUSED');
   assert.deepEqual(domain(r,'SPHERICAL').reasons,['ZERO_DIRECTION']);assert.equal(r.research.geometry.reason,'ZERO_DIRECTION');
   assert.equal(r.research.geometry.trajectory,null);assert.equal(r.research.geometry.states[0].u,null);
   console.log(`ZERO ${d}D: engine.geometry=${r.research.applicability.geometry}, engine.reason=${r.research.reason}, E.reason=${r.research.geometry.reason}, M=${domain(r,'SPHERICAL').status}`);
 });
 test(`${d}D actual constant first coordinate: M pending, H refuses, I spectral refuses`,async()=>{
   const r=await runResearchBridge(request(d,3,(i,j)=>j===0?5:i+j+1));noAuthority(r);
   assert.deepEqual(r.applicability.facts.constantColumns,[0]);assert.equal(domain(r,'STATISTICS').status,'PENDING_PREREQUISITE');
   assert.equal(r.research.diagnostics.statistics.first_two_features.status,'REFUSED');
   assert.equal(r.research.diagnostics.statistics.first_two_features.reason_code,'CONSTANT');
   assert.ok(r.research.applicability.spectral.reasons.includes('CONSTANT_SERIES'));
 });
 test(`${d}D two actual states: dynamics pending and H refuses insufficient overlap`,async()=>{
   const r=await runResearchBridge(request(d,2));noAuthority(r);
   assert.equal(r.applicability.facts.sampleCount,2);assert.equal(domain(r,'DYNAMICS').status,'PENDING_PREREQUISITE');
   assert.equal(r.research.diagnostics.statistics.first_two_features.reason_code,'INSUFFICIENT_OVERLAP');
   assert.ok(r.research.applicability.spectral.reasons.includes('INSUFFICIENT_SAMPLES'));
 });
 test(`${d}D revision at as_of cannot clear zero-direction refusal`,async()=>{
   const q=request(d,3,(i,j)=>i===0?0:i+j+1);
   q.rows.push(...q.rows.filter(x=>x.end_ms===2000).map(x=>({...x,revision:1,available_ms:q.as_of_ms,value_bits:binary64Hex(100)})));
   const r=await runResearchBridge(q);noAuthority(r);assert.equal(domain(r,'SPHERICAL').status,'REFUSED');
   assert.equal(r.research.alignment.selected.filter(x=>x.end_ms===2000).length,d);
   assert.ok(r.research.alignment.selected.every(x=>x.available_ms<q.as_of_ms));
   assert.ok(r.research.alignment.selected.filter(x=>x.end_ms===2000).every(x=>x.revision===0));
 });
 test(`${d}D nine states: pairwise limit NOT_RUN, graph/topology remain pending`,async()=>{
   const r=await runResearchBridge(request(d,9));noAuthority(r);
   assert.equal(r.applicability.facts.sampleCount,9);assert.equal(r.research.diagnostics.geometry.status,'NOT_RUN');
   assert.equal(r.research.diagnostics.geometry.reason,'PAIRWISE_SUPPORT_LIMIT_8');
   assert.equal(domain(r,'GRAPH').status,'PENDING_PREREQUISITE');assert.equal(domain(r,'TOPOLOGY').status,'PENDING_PREREQUISITE');
 });
 test(`${d}D finite inputs with overflowing norm: no positive M or geometry claim`,async()=>{
   const r=await runResearchBridge(request(d,3,(_i,j)=>j<2?Number.MAX_VALUE:0));noAuthority(r);
   assert.equal(r.research.reason,'NUMERIC_OVERFLOW');assert.equal(r.research.geometry,null);assert.equal(r.research.applicability.geometry,false);
   assert.equal(r.applicability,null);
 });
}

for(const stamp of [2000,3000,4000]) test(`32D exact requested window: missing f31 at ${stamp}, late value cannot rescue`,async()=>{
  const q=request(32);const missing=q.rows.find(x=>x.series==='f31'&&x.end_ms===stamp);missing.available_ms=q.as_of_ms;
  const r=await runResearchBridge(q);noAuthority(r);
  assert.deepEqual({...r.requested},{start_ms:1000,end_ms:4000,as_of_ms:5000,cadence_ms:1000});
  assert.deepEqual(r.research.gaps,[stamp]);assert.deepEqual(r.research.alignment.missing,[[stamp,['f31']]]);
  assert.equal(r.research.alignment.support.length,2);assert.equal(r.applicability,null);assert.equal(r.research.geometry,null);assert.equal(r.research.diagnostics,null);
  assert.equal(r.research.reason,'INCOMPLETE_AS_OF_WINDOW');assert.ok(r.research.applicability.spectral.reasons.includes('GAPS'));
  assert.ok(r.research.alignment.selected.every(x=>x.available_ms<q.as_of_ms));
});
test('32D reversed roster and input order: constant coordinate is derived in roster order',async()=>{
 const q=request(32,3,(i,j)=>j===0?5:i+j+1);q.roster.reverse();q.rows.reverse();const r=await runResearchBridge(q);noAuthority(r);
 assert.deepEqual(r.research.alignment.roster,q.roster);assert.deepEqual(r.applicability.facts.constantColumns,[31]);
 assert.equal(domain(r,'STATISTICS').status,'PENDING_PREREQUISITE');assert.equal(r.research.diagnostics.statistics.first_two_features.status,'OK');
 assert.ok(r.research.applicability.spectral.reasons.includes('CONSTANT_SERIES'));
});
