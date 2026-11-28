import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {inspectGridResearchSnapshot} from '../src/math-universe-research-bridge.mjs';
import {semanticDigest} from '../src/math-universe-codec.mjs';
const snapshots=JSON.parse(execFileSync('python',['-I','-B',new URL('./produce.py',import.meta.url).pathname],{maxBuffer:1000000}));
for(const [name,status,missing] of [['complete','PARTIAL',0],['gapped','GAP',4],['empty','UNAVAILABLE',4]]) test(`real Grid producer ${name} retains unauthenticated provenance`,()=>{
 const q=snapshots[name], r=inspectGridResearchSnapshot(q);
 assert.equal(q.status,status);assert.equal(q.coverage.missing_minutes,missing);
 assert.equal(r.status,'ABSTAIN');assert.equal(r.research,null);assert.equal(r.execution_authority,false);assert.equal(r.trading_authorized,false);
 assert.equal(r.source_provenance.source_authenticity,'UNATTESTED');assert.equal(r.source_provenance.availability_at_decision,'UNATTESTED');
 assert.equal(r.source_provenance.independent_receipt,null);assert.equal(r.snapshot_ref,semanticDigest(q.schema,q));
 assert.deepEqual(JSON.parse(JSON.stringify(r.coverage)),q.coverage);assert.deepEqual(JSON.parse(JSON.stringify(r.requested)),q.selection);
 assert.deepEqual(JSON.parse(JSON.stringify(r.source_provenance)),q.provenance);
});
test('producer output with forged source receipt or extra row claim is refused',()=>{
 for(const mutate of [q=>q.provenance.independent_receipt='a'.repeat(64),q=>q.rows[0].formalProof=true,q=>q.formalProof=true]){
 const q=structuredClone(snapshots.complete);mutate(q);assert.throws(()=>inspectGridResearchSnapshot(q),/GRID_RESEARCH_SCHEMA/);
 }
});
test('257 observed rows exceed documented Math inspector bound, refuse without silent truncation',()=>{
 const q=snapshots.limit;assert.equal(q.rows.length,257);assert.equal(q.status,'PARTIAL');assert.throws(()=>inspectGridResearchSnapshot(q),/GRID_RESEARCH_SCHEMA/);
});
