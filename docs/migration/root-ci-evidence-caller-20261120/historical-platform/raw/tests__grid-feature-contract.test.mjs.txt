import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGridFeatureHandoff} from '../src/grid-feature-contract.mjs';
const handoff={api_version:{major:1,minor:1},producer:'strattester',mode:'HISTORICAL',
 execution_authority:false,dataset:{coverage:'COMPLETE',missing_data:[]}};
const rows=()=>[0,1].map(i=>({closeTime:(i+1)*60000,availableAt:(i+1)*60000,
 close:70000+i,features:{volume:1,imbalance:0,openInterestChange:0,volatility:.1}}));
test('untrusted source is always blocked even if payload resembles valid handoff',()=>{
 const r=inspectGridFeatureHandoff(handoff,rows());assert.equal(r.reason,'SOURCE_PROVENANCE_UNATTESTED');
 assert.equal(r.admission,'BLOCKED');assert.equal(r.rows.length,0);
});
test('Grid candle-only export cannot invent missing L2/OI/availability fields',()=>{
 const candleOnly=[{open_time:0,close:70000,volume:1},{open_time:60000,close:70001,volume:2}];
 assert.equal(inspectGridFeatureHandoff(handoff,candleOnly,true).status,'BLOCKED');
 const missing=rows();delete missing[1].features.imbalance;
 assert.equal(inspectGridFeatureHandoff(handoff,missing,true).reason,'FEATURES_UNAVAILABLE');
});
test('schema compatible records do not grant provenance or execution authority',()=>{
 const r=inspectGridFeatureHandoff(handoff,rows(),true);
 assert.equal(r.status,'SCHEMA_COMPATIBLE_NOT_ATTESTED');
 assert.equal(r.provenance,'NOT_VERIFIED');
 assert.equal(r.trading,'DISABLED');
 assert.equal(r.admission,'BLOCKED');
});
test('future-available rows and incomplete coverage fail closed',()=>{
 const invalid=rows();invalid[1].availableAt=invalid[1].closeTime+1;
 assert.equal(inspectGridFeatureHandoff(handoff,invalid,true).reason,'TIME_CAUSALITY_UNVERIFIED');
 assert.equal(inspectGridFeatureHandoff({...handoff,dataset:{coverage:'PARTIAL',missing_data:[1]}},rows(),true).reason,'INCOMPLETE_DATASET');
});
