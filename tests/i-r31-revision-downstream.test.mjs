import test from 'node:test';
import assert from 'node:assert/strict';
import {runResearchBridge} from '../src/math-universe-research-bridge.mjs';
import {binary64Hex,decodeBinary64Hex} from '../src/math-universe-codec.mjs';
const start=1700000100000, step=1000, end=start+4*step, cutoff=end+2000;
const roster=Array.from({length:32},(_,i)=>`f${i}`);
const q={schema:'math.universe.research.request.v1',start_ms:start,end_ms:end,as_of_ms:cutoff,cadence_ms:step,roster,
 rows:Array.from({length:4},(_,i)=>roster.map((series,j)=>({series,epoch:'synthetic',end_ms:start+(i+1)*step,available_ms:start+(i+1)*step+1,revision:0,value_bits:binary64Hex(Number(i===j))}))).flat()};
const x=q.rows[0];
q.rows.push({...x,revision:1,available_ms:cutoff-1,value_bits:binary64Hex(2)},
 {...x,revision:2,available_ms:cutoff,value_bits:binary64Hex(99)});
const number=x=>decodeBinary64Hex(x.binary64);
function deny(result){
 assert.equal(result.status,'ABSTAIN');assert.equal(result.source_authenticity,'UNATTESTED');
 assert.equal(result.execution_authority,false);assert.equal(result.trading_authorized,false);
 assert.equal(result.research.qualified,false);assert.equal(result.research.authority,'NONE');
}
test('admitted revision reaches exact raw geometry and downstream distance, excluded revision does not',async()=>{
 const later=await runResearchBridge(q), earlier=await runResearchBridge({...q,as_of_ms:cutoff-1});
 for(const [r,amplitude] of [[later,2],[earlier,1]]){
  deny(r);assert.deepEqual(r.research.gaps,[]);assert.equal(r.research.applicability.geometry,true);
  assert.equal(r.research.alignment.support.length,4);
  assert.equal(number(r.research.alignment.support[0][1][0]),amplitude);
  assert.equal(number(r.research.geometry.states[0].raw[0]),amplitude);
  assert.equal(number(r.research.geometry.states[0].rho),amplitude);
  assert.equal(number(r.research.geometry.states[0].u[0]),1);
  assert.equal(number(r.research.geometry.trajectory.angles[0]),Math.PI/2);
  const g=r.research.diagnostics.geometry;
  assert.equal(g.status,'COMPUTED');assert.deepEqual(g.state_event_end_ms,[start+step,start+2*step,start+3*step,end]);
  assert.deepEqual(g.pair_order[0],[0,1]);assert.equal(number(g.pairwise_distances[0]),Math.sqrt(amplitude*amplitude+1));
  assert.equal(r.applicability.facts.dimension,32);assert.equal(r.applicability.facts.sampleCount,4);
 }
});
