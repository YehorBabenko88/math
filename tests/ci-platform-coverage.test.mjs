import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const expected={head:'a'.repeat(40),tree:'b'.repeat(40),runId:'7',attempt:'1',policyDigest:'c'.repeat(64),
 fullInventory:['tests/native.test.mjs','tests/pg.test.mjs'],policy:{cases:[
  {file:'tests/native.test.mjs',name:'native',platform:'win32'},
  {file:'tests/pg.test.mjs',name:'posix',platform:'linux'}]}};
function receipts(){
 return [22,24].flatMap(node=>[16,18].map(postgres=>({platform:'linux',node,postgres})).concat({platform:'win32',node,postgres:null})).map(cell=>({
  schema:'math.ci.platform-receipt.v1',...cell,nodeVersion:`v${cell.node}.0.0`,job:cell.platform==='linux'?'postgres-integration':'windows-platform',head:expected.head,tree:expected.tree,runId:'7',attempt:'1',policyDigest:expected.policyDigest,
  fullInventory:expected.fullInventory,inventory:cell.platform==='linux'?expected.fullInventory:['tests/native.test.mjs','tests/pg.test.mjs'],
  status:'PASS',summary:{tests:2,pass:2,fail:0,skipped:0,cancelled:0,todo:0},
  cases:expected.policy.cases.map(c=>({id:c.file+'::'+c.name,disposition:c.platform===cell.platform?'EXECUTED':'NOT_RUN'}))
 }));
}

test('coverage requires four PG cells and both Windows cells, never routed-only proof',async()=>{
 const {validateCoverageBundle}=await import('../scripts/ci-platform-coverage.mjs');
 assert.doesNotThrow(()=>validateCoverageBundle(receipts(),expected));
 for(const mutate of [r=>r.pop(),r=>r.splice(0,1),r=>r.push(r[0]),r=>r[0].cases[0].disposition='EXECUTED',
  r=>r.find(x=>x.platform==='win32').cases[0].disposition='NOT_RUN',r=>r[0].cases.pop(),
  r=>r[0].cases.push(r[0].cases[0]),r=>r[0].cases[0].id='unknown',r=>r[0].head='d'.repeat(40),
  r=>r[0].attempt='2',r=>r[0].runId='8',r=>r[0].tree='e'.repeat(40),r=>r[0].policyDigest='f'.repeat(64),
  r=>r[0].status='FAIL',r=>r[0].summary.skipped=1,r=>r[0].summary.fail=1,r=>r[0].summary.tests=0,
  r=>r[0].fullInventory.pop(),r=>r[0].inventory.pop(),r=>r[0].nodeVersion='v24.0.0',r=>r[0].job='wrong']){
  const rows=structuredClone(receipts());mutate(rows);assert.throws(()=>validateCoverageBundle(rows,expected));
 }
});

test('artifact checksums require each exact file once and bind stderr as well as TAP',async()=>{
 const {verifyArtifactFiles}=await import('../scripts/ci-platform-coverage.mjs');
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const tap=Buffer.from('\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n');
 const stderr=Buffer.from(''),result=Buffer.from(JSON.stringify({testLogSHA256:hash(tap),stderrSHA256:hash(stderr),summary:{tests:1,suites:0,pass:1,fail:0,cancelled:0,skipped:0,todo:0}}));
 const files={'result.json':result,'tests.tap':tap,'stderr.txt':stderr};
 files.SHA256SUMS=Buffer.from(Object.entries(files).map(([n,b])=>hash(b)+'  '+n).join('\n'));
 assert.doesNotThrow(()=>verifyArtifactFiles(files));
 for(const mutate of [f=>f.SHA256SUMS=Buffer.from((hash(result)+'  result.json\n').repeat(3)),
  f=>delete f['stderr.txt'],f=>f['stderr.txt']=Buffer.from('changed'),f=>f.extra=Buffer.from('x')]){
  const changed={...files};mutate(changed);assert.throws(()=>verifyArtifactFiles(changed));
 }
});
