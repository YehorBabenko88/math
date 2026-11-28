import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGridResearchSnapshot} from '../src/math-universe-research-bridge.mjs';
import {semanticDigest} from '../src/math-universe-codec.mjs';
// Source-derived synthetic fixture, Grid 1e093da12a9756bb8c5e97cabf2707bee7ef4dd7,
// grid/qualified_ohlcv.py 5e8d2a9d0c497389ea27eb024cdbd6c151e8c00d.
// Not an actual database or producer execution.
const snapshot=()=>({schema:'grid.ohlcv_1m.descriptive.v1',read_only:true,descriptive_only:true,symbol:'BTCUSDT',timeframe:'1m',selection:{start_ms:0,end_ms:60000,as_of_ms:120000,interval_semantics:'HALF_OPEN_UTC_MS'},status:'PARTIAL',reason:'SOURCE_AVAILABILITY_NOT_ATTESTED',coverage:{expected_minutes:1,observed_minutes:1,missing_minutes:0,gaps:[],basis:'LOCAL_STORED_ROW_OBSERVATION_ONLY'},provenance:{dataset:'ohlcv_1m',owner:'Grid',source_declarations:['BYBIT_REST'],source_authenticity:'UNATTESTED',source_revision:null,raw_frame_sha256:null,independent_receipt:null,exchange_completeness:'NOT_ATTESTED',storage_immutability:'NOT_ATTESTED',availability_at_decision:'UNATTESTED',clock_receipt:null,numerical_encoding:'POSTGRES_NUMERIC_FIXED_DECIMAL_STRING'},execution_authority:false,trading_authorized:false,paper_admitted:false,causal_research_admitted:false,rows:[{t:0,open:'0.000000000000000001',high:'2',low:'0.5',close:'1.5',volume:'1',turnover:null,source_declared:'BYBIT_REST'}]});
const verifyControl=q=>{const r=inspectGridResearchSnapshot(q);assert.equal(r.status,'ABSTAIN');assert.equal(r.reason,'GRID_AVAILABILITY_UNATTESTED');assert.equal(r.execution_authority,false);assert.equal(r.trading_authorized,false);assert.equal(r.research,null);assert.equal(r.snapshot_ref,semanticDigest(q.schema,q));return r;};
test('complete pinned-producer-shaped DTO is admitted only as descriptive ABSTAIN',()=>verifyControl(snapshot()));
const goalHash=semanticDigest('synthetic.k27.goal',{claim:'self asserted'});
for(const [location,field,value] of [['root','typed_goal_hash',goalHash],['row','typed_goal_hash',goalHash],['root','certificate',{typed_goal_hash:goalHash,formalProof:true}],['row','certificate',{typed_goal_hash:goalHash,formalProof:true}]]){
 test(`reject self-asserted ${field} at ${location} on valid complete DTO`,()=>{const q=snapshot();verifyControl(q);(location==='root'?q:q.rows[0])[field]=value;assert.throws(()=>inspectGridResearchSnapshot(q),/GRID_RESEARCH_SCHEMA/);});
}
