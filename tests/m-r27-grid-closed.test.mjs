import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGridResearchSnapshot} from '../src/math-universe-research-bridge.mjs';
const fixture=()=>({schema:'grid.ohlcv_1m.descriptive.v1',read_only:true,descriptive_only:true,symbol:'BTCUSDT',timeframe:'1m',selection:{start_ms:60000,end_ms:180000,as_of_ms:240000,interval_semantics:'HALF_OPEN_UTC_MS'},status:'PARTIAL',reason:'SOURCE_AVAILABILITY_NOT_ATTESTED',coverage:{expected_minutes:2,observed_minutes:2,missing_minutes:0,gaps:[],basis:'LOCAL_STORED_ROW_OBSERVATION_ONLY'},provenance:{owner:'Grid',availability_at_decision:'UNATTESTED',source_authenticity:'UNATTESTED',dataset:'ohlcv_1m',source_declarations:['stored'],source_revision:null,raw_frame_sha256:null,independent_receipt:null,exchange_completeness:'NOT_ATTESTED',storage_immutability:'NOT_ATTESTED',clock_receipt:null,numerical_encoding:'POSTGRES_NUMERIC_FIXED_DECIMAL_STRING'},execution_authority:false,trading_authorized:false,paper_admitted:false,causal_research_admitted:false,rows:[60000,120000].map(t=>({t,open:'100',high:'103',low:'99',close:'102',volume:'1',turnover:null,source_declared:'stored'}))});
test('full descriptive fixture valid, no authority',()=>{const r=inspectGridResearchSnapshot(fixture());assert.equal(r.status,'ABSTAIN');assert.equal(r.execution_authority,false);assert.equal(r.trading_authorized,false);assert.equal(r.research,null);});
for(const [label,mutate] of [
 ['root unknown innocuous field',q=>q.note='extra'],
 ['second row unknown innocuous field',q=>q.rows[1].note='extra'],
 ['second row missing required close',q=>delete q.rows[1].close],
 ['second row same-count replacement',q=>{delete q.rows[1].close;q.rows[1].prediction='102';}],
 ['root same-count replacement',q=>{delete q.symbol;q.symbol_alias='BTCUSDT';}],
])test(label,()=>{const q=fixture();mutate(q);assert.throws(()=>inspectGridResearchSnapshot(q),/GRID_RESEARCH_SCHEMA/);});
