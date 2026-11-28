import test from 'node:test';
import assert from 'node:assert/strict';
import {binary64Hex,encodeMetadata} from '../src/math-universe-codec.mjs';
const load = () => import('../src/math-universe-research-bridge.mjs');
const request = (dimension=4) => ({schema:'math.universe.research.request.v1',
 start_ms:0,end_ms:3000,as_of_ms:5000,cadence_ms:1000,
 roster:Array.from({length:dimension},(_,i)=>`f${i}`),
 rows:Array.from({length:3},(_,i)=>Array.from({length:dimension},(_,j)=>({series:`f${j}`,epoch:'test',end_ms:(i+1)*1000,available_ms:(i+1)*1000+1,revision:0,value_bits:binary64Hex(1+i+j)}))).flat()});
test('actual composition derives 4D applicability and never grants evidence or authority',async()=>{
 const {runResearchBridge}=await load(); const r=await runResearchBridge(request());
 assert.equal(r.status,'ABSTAIN'); assert.equal(r.execution_authority,false); assert.equal(r.trading_authorized,false);
 assert.equal(r.applicability.facts.dimension,4); assert.equal(r.applicability.facts.sampleCount,3);
 assert.ok(r.research.geometry); assert.equal(r.research.geometry.status,'UNQUALIFIED');
 assert.deepEqual({...r.requested},{start_ms:0,end_ms:3000,as_of_ms:5000,cadence_ms:1000});
});
for(const missing of [1000,2000,3000]) test(`preserves requested boundary with missing close ${missing}`,async()=>{
 const {runResearchBridge}=await load();const q=request();q.rows=q.rows.filter(r=>!(r.end_ms===missing&&r.series==='f3'));
 const r=await runResearchBridge(q);assert.equal(r.status,'ABSTAIN'); assert.ok(r.research.gaps.includes(missing));
 assert.equal(r.research.geometry,null);assert.equal(r.applicability,null);assert.equal(r.requested.start_ms,0);assert.equal(r.requested.end_ms,3000);
});
test('availability equality is excluded using the original as_of',async()=>{
 const {runResearchBridge}=await load();const q=request();q.rows[0].available_ms=q.as_of_ms;
 const r=await runResearchBridge(q);assert.ok(r.research.gaps.includes(1000));assert.equal(r.requested.as_of_ms,5000);
});
test('32 feature roster uses real I alignment and data-derived M applicability',async()=>{
 const {runResearchBridge}=await load();const r=await runResearchBridge(request(32));assert.equal(r.applicability.facts.dimension,32);
 assert.equal(r.research.alignment.roster.length,32);assert.equal(r.status,'ABSTAIN');
});
test('accessors and Proxy are refused without executing user code',async()=>{
 const {runResearchBridge}=await load();let calls=0;const q=request();Object.defineProperty(q,'rows',{get(){calls++;throw Error('getter');},enumerable:true});
 await assert.rejects(runResearchBridge(q),/INVALID_METADATA/);assert.equal(calls,0);
 await assert.rejects(runResearchBridge(new Proxy(request(),{ownKeys(){calls++;throw Error('proxy');}})),/INVALID_METADATA/);assert.equal(calls,0);
});
test('caller authority, arbitrary applicability and unbounded budgets are refused',async()=>{
 const {runResearchBridge}=await load();for(const extra of [{execution_authority:true},{applicability:{SPHERICAL:true}},{budget:{max_ops:Number.MAX_SAFE_INTEGER}}])
 await assert.rejects(runResearchBridge({...request(),...extra}),/INVALID_RESEARCH_REQUEST/);
});
test('budget exhaustion yields typed refusal with no partial research result',async()=>{
 const {runResearchBridge}=await load();const q=request();q.budget={max_ops:0,max_read_bytes:0,max_write_bytes:0,max_live_bytes:0,max_output_bytes:0};
 await assert.rejects(runResearchBridge(q),/BUDGET_EXCEEDED/);
});
test('public wire and incomplete-window processing obey the canonical V byte limits',async()=>{
 const {runResearchBridge}=await load();const q=request();q.rows=[];
 q.budget={max_ops:100000,max_read_bytes:0,max_write_bytes:0,max_live_bytes:1000000,max_output_bytes:1000};
 await assert.rejects(runResearchBridge(q),/BUDGET_EXCEEDED/);
 const result=await runResearchBridge(request());
 assert.ok(result.research.logical_budget.read_bytes>0);
 assert.ok(result.research.logical_budget.write_bytes>0);
});
test('existing Grid descriptive interface retains request and gaps without inventing availability',async()=>{
 const {inspectGridResearchSnapshot}=await load();
 const snapshot={schema:'grid.ohlcv_1m.descriptive.v1',read_only:true,descriptive_only:true,symbol:'BTCUSDT',timeframe:'1m',
  selection:{start_ms:0,end_ms:180000,as_of_ms:240000,interval_semantics:'HALF_OPEN_UTC_MS'},status:'GAP',reason:'INCOMPLETE_STORED_MINUTES',
  coverage:{expected_minutes:3,observed_minutes:1,missing_minutes:2,gaps:[{start_ms:0,end_ms:60000,missing_minutes:1,reason:'MINUTE_NOT_STORED'},{start_ms:120000,end_ms:180000,missing_minutes:1,reason:'MINUTE_NOT_STORED'}],basis:'LOCAL_STORED_ROW_OBSERVATION_ONLY'},
  provenance:{owner:'Grid',availability_at_decision:'UNATTESTED',source_authenticity:'UNATTESTED'},
  execution_authority:false,trading_authorized:false,paper_admitted:false,causal_research_admitted:false,
  rows:[{t:60000,open:'100',high:'103',low:'99',close:'102',volume:'1',turnover:null,source_declared:'stored'}]};
 const result=inspectGridResearchSnapshot(snapshot);assert.equal(result.status,'ABSTAIN');
 assert.equal(result.reason,'GRID_AVAILABILITY_UNATTESTED');assert.equal(result.requested.start_ms,0);assert.equal(result.requested.end_ms,180000);
 assert.equal(result.coverage.gaps.length,2);assert.equal(result.research,null);assert.equal(result.trading_authorized,false);
 assert.throws(()=>inspectGridResearchSnapshot({...snapshot,execution_authority:true}),/GRID_RESEARCH_SCHEMA/);
});
test('wire custody is not hidden by cumulative intermediate output credits',async()=>{
 const {runResearchBridge}=await load();const q=request();q.end_ms=32000;q.as_of_ms=34000;
 q.rows=Array.from({length:32},(_,i)=>Array.from({length:4},(_,j)=>({series:`f${j}`,epoch:'test',end_ms:(i+1)*1000,available_ms:(i+1)*1000+1,revision:0,value_bits:binary64Hex(1+(i+j)%7)}))).flat();
 const r=await runResearchBridge(q);
 assert.ok(r.research.logical_budget.live_bytes>=encodeMetadata(r).length,'public wire must retain actual V custody');
});

test('A1 rejects contradictory gap complement and unattested provenance claims',async()=>{
 const {inspectGridResearchSnapshot}=await load();
 const q={schema:'grid.ohlcv_1m.descriptive.v1',read_only:true,descriptive_only:true,symbol:'BTCUSDT',timeframe:'1m',
 selection:{start_ms:0,end_ms:180000,as_of_ms:240000,interval_semantics:'HALF_OPEN_UTC_MS'},status:'GAP',reason:'INCOMPLETE_STORED_MINUTES',
 coverage:{expected_minutes:3,observed_minutes:1,missing_minutes:2,basis:'LOCAL_STORED_ROW_OBSERVATION_ONLY',gaps:[{start_ms:0,end_ms:60000,missing_minutes:1,reason:'MINUTE_NOT_STORED'},{start_ms:120000,end_ms:180000,missing_minutes:1,reason:'MINUTE_NOT_STORED'}]},
 provenance:{owner:'Grid',availability_at_decision:'UNATTESTED',source_authenticity:'UNATTESTED'},
 execution_authority:false,trading_authorized:false,paper_admitted:false,causal_research_admitted:false,
 rows:[{t:60000,open:'100',high:'103',low:'99',close:'102',volume:'1',turnover:null,source_declared:'stored'}]};
 assert.equal(inspectGridResearchSnapshot(q).status,'ABSTAIN');
 for(const gaps of [[],[q.coverage.gaps[0],q.coverage.gaps[0]],[{start_ms:60000,end_ms:180000,missing_minutes:2,reason:'MINUTE_NOT_STORED'}]])assert.throws(()=>inspectGridResearchSnapshot({...q,coverage:{...q.coverage,gaps}}),/GRID_RESEARCH_SCHEMA/);
 for(const claim of [{source_authenticity:'VERIFIED'},{execution_authority:true},{formalProof:true},{proof_status:'VERIFIED'},{typed_goal_hash:'a'.repeat(64)},{certificate:{formalProof:true}}])assert.throws(()=>inspectGridResearchSnapshot({...q,provenance:{...q.provenance,...claim}}),/GRID_RESEARCH_SCHEMA/);
 const provenance={...q.provenance,dataset:'ohlcv_1m',source_declarations:['stored'],source_revision:null,raw_frame_sha256:null,independent_receipt:null,exchange_completeness:'NOT_ATTESTED',storage_immutability:'NOT_ATTESTED',clock_receipt:null,numerical_encoding:'POSTGRES_NUMERIC_FIXED_DECIMAL_STRING'};
 assert.equal(inspectGridResearchSnapshot({...q,provenance}).status,'ABSTAIN');
 assert.throws(()=>inspectGridResearchSnapshot({...q,provenance:{...provenance,independent_receipt:'fake'}}),/GRID_RESEARCH_SCHEMA/);
});
