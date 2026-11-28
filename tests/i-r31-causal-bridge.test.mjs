import test from 'node:test';
import assert from 'node:assert/strict';
import {runResearchBridge} from '../src/math-universe-research-bridge.mjs';
import {binary64Hex} from '../src/math-universe-codec.mjs';
const start=1700000000000, step=1000, end=start+4000, cutoff=end+2000;
function request(){
 const roster=Array.from({length:32},(_,i)=>`f${i}`);
 return {schema:'math.universe.research.request.v1',start_ms:start,end_ms:end,as_of_ms:cutoff,cadence_ms:step,roster,
 rows:Array.from({length:4},(_,i)=>roster.map((series,j)=>({series,epoch:'synthetic',end_ms:start+(i+1)*step,available_ms:start+(i+1)*step+1,revision:0,value_bits:binary64Hex(1+(i+j)%7)}))).flat()};
}
function assertWindow(r,q){
 assert.deepEqual({...r.requested},{start_ms:q.start_ms,end_ms:q.end_ms,as_of_ms:q.as_of_ms,cadence_ms:q.cadence_ms});
 assert.equal(r.status,'ABSTAIN'); assert.equal(r.execution_authority,false); assert.equal(r.trading_authorized,false);
 assert.equal(r.research.qualified,false); assert.equal(r.source_authenticity,'UNATTESTED');
}
test('shifted window: distinct missing features at both ends and interior',async()=>{
 const q=request(); const missing=[[start+step,'f31'],[start+2*step,'f0'],[end,'f17']];
 for(const [t,s] of missing) q.rows.find(r=>r.end_ms===t&&r.series===s).available_ms=cutoff;
 const r=await runResearchBridge(q); assertWindow(r,q);
 assert.deepEqual(r.research.gaps,missing.map(x=>x[0]));
 assert.deepEqual(r.research.alignment.missing,missing.map(([t,s])=>[t,[s]]));
 assert.deepEqual(r.research.alignment.support.map(p=>p[0]),[start+3*step]);
 assert.equal(r.research.geometry,null); assert.equal(r.applicability,null);
});
test('snapshot cutoff: exact admitted and excluded revisions, no historical authority',async()=>{
 const q=request();const original=q.rows[0];
 q.rows.push({...original,revision:1,available_ms:cutoff-1,value_bits:binary64Hex(17)},
 {...original,revision:2,available_ms:cutoff,value_bits:binary64Hex(19)},
 {...original,revision:3,available_ms:cutoff+1,value_bits:binary64Hex(23)});
 const r=await runResearchBridge(q);assertWindow(r,q);
 const selected=r.research.alignment.selected.find(x=>x.series===original.series&&x.end_ms===original.end_ms);
 assert.equal(selected.revision,1);assert.equal(selected.available_ms,cutoff-1);
 assert.deepEqual(r.research.alignment.ledger.filter(x=>x.series===original.series&&x.end_ms===original.end_ms).map(x=>x.revision),[0,1]);
 const earlier={...q,as_of_ms:cutoff-1};const p=await runResearchBridge(earlier);assertWindow(p,earlier);
 assert.equal(p.research.alignment.selected.find(x=>x.series===original.series&&x.end_ms===original.end_ms).revision,0);
});
test('valid future and outside-window append preserve selected evidence, not request identity',async()=>{
 const q=request(); const a=await runResearchBridge(q);assertWindow(a,q);
 const original=q.rows[0];const expanded={...q,rows:[...q.rows,{...original,revision:9,available_ms:cutoff,value_bits:binary64Hex(99)},
 {...original,end_ms:start,available_ms:start+1}, {...original,end_ms:end+step,available_ms:end+step+1}]};
 const b=await runResearchBridge(expanded);assertWindow(b,expanded);
 assert.deepEqual(b.research.alignment,a.research.alignment);assert.notEqual(b.request_ref,a.request_ref);
});
