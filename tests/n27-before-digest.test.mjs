import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
import {inspectGridResearchSnapshot} from '../src/math-universe-research-bridge.mjs';
const fixture=()=>({schema:'grid.ohlcv_1m.descriptive.v1',read_only:true,descriptive_only:true,symbol:'BTCUSDT',timeframe:'1m',selection:{start_ms:0,end_ms:60000,as_of_ms:120000,interval_semantics:'HALF_OPEN_UTC_MS'},status:'PARTIAL',reason:'SOURCE_AVAILABILITY_NOT_ATTESTED',coverage:{expected_minutes:1,observed_minutes:1,missing_minutes:0,gaps:[],basis:'LOCAL_STORED_ROW_OBSERVATION_ONLY'},provenance:{owner:'Grid',availability_at_decision:'UNATTESTED',source_authenticity:'UNATTESTED'},execution_authority:false,trading_authorized:false,paper_admitted:false,causal_research_admitted:false,rows:[{t:0,open:'100',high:'103',low:'99',close:'102',volume:'1',turnover:null,source_declared:'stored'}]});
test('actual SHA256 creation is never reached for unknown authority/proof fields',()=>{
 const original=crypto.createHash; let calls=0;
 crypto.createHash=function(...args){calls++;return Reflect.apply(original,this,args);};
 syncBuiltinESMExports();
 try{
  const good=inspectGridResearchSnapshot(fixture());
  assert.equal(calls,1,'positive control must exercise real digest');
  assert.match(good.snapshot_ref,/^[a-f0-9]{64}$/);
  assert.equal(good.status,'ABSTAIN');
  assert.equal(good.execution_authority,false);
  assert.equal(good.trading_authorized,false);
  for(const mutate of [q=>q.promotion_authorized=true,q=>q.evolution={execution_authority:true},q=>q.rows[0].execution_authority=true,q=>q.rows[0].proof={verified:true}]){
   const q=fixture();mutate(q);const before=calls;
   assert.throws(()=>inspectGridResearchSnapshot(q),/GRID_RESEARCH_SCHEMA/);
   assert.equal(calls,before,'invalid record reached digest');
  }
  const again=inspectGridResearchSnapshot(fixture());
  assert.equal(calls,2,'second valid control must exercise real digest');
  assert.equal(again.snapshot_ref,good.snapshot_ref);
 }finally{crypto.createHash=original;syncBuiltinESMExports();}
});
