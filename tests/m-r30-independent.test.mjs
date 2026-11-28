import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGridResearchSnapshot,runResearchBridge} from '../src/math-universe-research-bridge.mjs';
import {binary64Hex,decodeBinary64Hex,encodeMetadata,semanticDigest} from '../src/math-universe-codec.mjs';
// Synthetic full Grid contract, NOT a live producer or authenticity receipt.
const snapshot=()=>({schema:'grid.ohlcv_1m.descriptive.v1',read_only:true,descriptive_only:true,symbol:'BTCUSDT',timeframe:'1m',selection:{start_ms:60000,end_ms:180000,as_of_ms:180000,interval_semantics:'HALF_OPEN_UTC_MS'},status:'PARTIAL',reason:'SOURCE_AVAILABILITY_NOT_ATTESTED',coverage:{expected_minutes:2,observed_minutes:2,missing_minutes:0,gaps:[],basis:'LOCAL_STORED_ROW_OBSERVATION_ONLY'},provenance:{owner:'Grid',availability_at_decision:'UNATTESTED',source_authenticity:'UNATTESTED',dataset:'ohlcv_1m',source_declarations:['archive','stored'],source_revision:null,raw_frame_sha256:null,independent_receipt:null,exchange_completeness:'NOT_ATTESTED',storage_immutability:'NOT_ATTESTED',clock_receipt:null,numerical_encoding:'POSTGRES_NUMERIC_FIXED_DECIMAL_STRING'},execution_authority:false,trading_authorized:false,paper_admitted:false,causal_research_admitted:false,rows:[60000,120000].map((t,i)=>({t,open:'100.0000',high:'103.0001',low:'99',close:'102',volume:'0.00000001',turnover:i?'1.2300':null,source_declared:i?'archive':'stored'}))});
function valid(){const q=snapshot(),r=inspectGridResearchSnapshot(q);assert.equal(r.status,'ABSTAIN');assert.equal(r.research,null);assert.equal(r.execution_authority,false);assert.equal(r.trading_authorized,false);assert.equal(r.source_provenance.source_authenticity,'UNATTESTED');assert.equal(r.snapshot_ref,semanticDigest(q.schema,q));return q;}
const deny=q=>assert.throws(()=>inspectGridResearchSnapshot(q),/GRID_RESEARCH_SCHEMA/);
test('full two-source fixed-decimal control preserves exact descriptive envelope',()=>{valid();});
test('every required root key: deletion and same-count replacement',()=>{const keys=Object.keys(valid());assert.equal(keys.length,15);for(const k of keys){for(const replace of [false,true]){const q=valid(),v=q[k];delete q[k];if(replace)q.unknown_key=v;deny(q);}}});
test('every required row key at both positions: deletion and same-count replacement',()=>{const keys=Object.keys(valid().rows[0]);assert.equal(keys.length,8);for(const i of [0,1])for(const k of keys)for(const replace of [false,true]){const q=valid(),r=q.rows[i],v=r[k];delete r[k];if(replace)r.unknown_key=v;deny(q);}});
test('unknown neutral and authority fields rejected in every row and root',()=>{for(const i of [-1,0,1])for(const [k,v] of [['note','hello'],['proof',{formalProof:true}],['verified',true]]){const q=valid();(i<0?q:q.rows[i])[k]=v;deny(q);}});
test('all numeric row values require literal fixed decimal and turnover nullable only',()=>{for(const k of ['open','high','low','close','volume','turnover'])for(const value of [1,'1e3','NaN','Infinity','1.','+1',' 1','1\n',{},[]]){const q=valid();q.rows[1][k]=value;deny(q);}for(const k of ['open','high','low','close','volume']){const q=valid();q.rows[1][k]=null;deny(q);}});
test('full source declarations must agree exactly with observed row sources',()=>{for(const declarations of [['archive'],['archive','archive'],['stored','archive'],['archive','stored','unknown']]){const q=valid();q.provenance.source_declarations=declarations;deny(q);}});
const request=d=>({schema:'math.universe.research.request.v1',start_ms:0,end_ms:3000,as_of_ms:5000,cadence_ms:1000,roster:Array.from({length:d},(_,i)=>`f${i}`),rows:Array.from({length:3},(_,i)=>Array.from({length:d},(_,j)=>({series:`f${j}`,epoch:'m-r30',end_ms:(i+1)*1000,available_ms:(i+1)*1000+1,revision:0,value_bits:binary64Hex(i===j?1:0)}))).flat()});
const number=x=>decodeBinary64Hex(x.binary64);
function noAuthority(r){assert.equal(r.status,'ABSTAIN');assert.equal(r.source_authenticity,'UNATTESTED');assert.equal(r.execution_authority,false);assert.equal(r.trading_authorized,false);assert.equal(r.research.qualified,false);assert.equal(r.research.authority,'NONE');}
for(const d of [4,32]){
 test(`${d}D real worker: highest available revisions and duplicate idempotence; exact geometry oracle`,async()=>{
  const q=request(d);const rev=[3,4,12].map((v,i)=>({...q.rows[i*d+i],revision:1,available_ms:4999,value_bits:binary64Hex(v)}));
  q.rows.push(...rev,{...rev[0]}, {...rev[1],revision:2,available_ms:5000,value_bits:binary64Hex(99)});q.rows.reverse();
  const r=await runResearchBridge(q);noAuthority(r);assert.deepEqual(r.research.gaps,[]);assert.equal(r.research.alignment.ledger.length,3*d+3);assert.equal(r.research.alignment.selected.length,3*d);
  assert.equal(r.research.alignment.selected.filter(x=>x.revision===1).length,3);assert.ok(r.research.alignment.selected.every(x=>x.available_ms<q.as_of_ms));
  assert.deepEqual(r.research.geometry.states.map(x=>number(x.rho)),[3,4,12]);assert.deepEqual(r.research.geometry.trajectory.angles.map(number),[Math.PI/2,Math.PI/2]);
  assert.deepEqual(r.research.diagnostics.geometry.pairwise_distances.map(number),[5,Math.sqrt(153),Math.sqrt(160)]);
  assert.equal(r.applicability.facts.dimension,d);assert.equal(r.applicability.domains.find(x=>x.domain==='SPHERICAL').status,'CANDIDATE');assert.equal(r.research.applicability.trajectory,true);
  assert.ok(r.research.logical_budget.live_bytes>=encodeMetadata(r).length);assert.equal(r.research.logical_budget.failed,false);
 });
 test(`${d}D real worker: conflicting available duplicate revision refused`,async()=>{const q=request(d);q.rows.push({...q.rows[0],value_bits:binary64Hex(2)});await assert.rejects(runResearchBridge(q),/RESEARCH_REFUSED/);});
 test(`${d}D real worker: conflicting available epoch refused`,async()=>{const q=request(d);q.rows.push({...q.rows[0],epoch:'other',revision:1});await assert.rejects(runResearchBridge(q),/RESEARCH_REFUSED/);});
 test(`${d}D real worker: zero logical ops fails closed, new isolated request succeeds`,async()=>{const q=request(d);q.budget={max_ops:0,max_read_bytes:16777216,max_write_bytes:16777216,max_live_bytes:67108864,max_output_bytes:262144};await assert.rejects(runResearchBridge(q),/BUDGET_EXCEEDED/);const r=await runResearchBridge(request(d));noAuthority(r);assert.equal(r.research.logical_budget.failed,false);assert.equal(r.research.applicability.trajectory,true);});
}
