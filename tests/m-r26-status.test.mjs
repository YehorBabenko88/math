import test from 'node:test';
import assert from 'node:assert/strict';
import {runResearchBridge} from '../src/math-universe-research-bridge.mjs';
import {binary64Hex} from '../src/math-universe-codec.mjs';
const request=(d,zero)=>({schema:'math.universe.research.request.v1',start_ms:1000,end_ms:4000,as_of_ms:5000,cadence_ms:1000,roster:Array.from({length:d},(_,j)=>`f${j}`),rows:Array.from({length:3},(_,i)=>Array.from({length:d},(_,j)=>({series:`f${j}`,epoch:'m-r26',end_ms:2000+i*1000,available_ms:2001+i*1000,revision:0,value_bits:binary64Hex(zero&&i===0?0:i+j+1)}))).flat()});
for(const d of [4,32]) for(const zero of [true,false]) test(`${d}D A2 ${zero?'zero':'nonzero'} direction status`,async()=>{
 const r=await runResearchBridge(request(d,zero));const a=r.research.applicability;
 assert.equal(a.normalization,true);assert.equal(a.trajectory,!zero);assert.equal(a.geometry,!zero);
 assert.equal(r.research.geometry.trajectory===null,zero);
 assert.equal(r.research.reason,zero?'ZERO_DIRECTION':'UNQUALIFIED_SOURCE_AND_FIT');
 assert.equal(r.applicability.domains.find(x=>x.domain==='SPHERICAL').status,zero?'REFUSED':'CANDIDATE');
 assert.ok(r.research.diagnostics);assert.equal(r.status,'ABSTAIN');assert.equal(r.execution_authority,false);assert.equal(r.trading_authorized,false);
});
