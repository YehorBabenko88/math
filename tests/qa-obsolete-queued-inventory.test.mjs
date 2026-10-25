import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const inventory=JSON.parse(readFileSync(new URL('../docs/audits/pr56-receiver/obsolete-queued-inventory.json',import.meta.url),'utf8'));
const runs=inventory.runs;
test('queued snapshot is non-atomic and never grants cancellation authority',()=>{
 assert.equal(inventory.completeness,'COMPLETE_ENUMERATION');
 assert.equal(inventory.enumeratedUniqueRuns,1878);
 assert.equal(runs.length,1878);
 assert.equal(new Set(runs.map(r=>r.id)).size,runs.length);
 assert.equal(runs.every(r=>r.observedStatus==='queued'),true);
 assert.equal(inventory.limitations.some(x=>/Non-atomic/.test(x)),true);
});
test('370 candidates are proposals, not verified safe-to-cancel executions',()=>{
 const c=runs.filter(r=>r.proposedCancellation);
 assert.equal(c.length,370);
 assert.equal(c.every(r=>r.classification==='SOURCE_HEAD_RAW_PUBLICATION_RISK'),true);
 assert.equal(c.filter(r=>r.event==='push').length,195);
 assert.equal(c.filter(r=>r.event==='pull_request').length,175);
 assert.equal(c.filter(r=>r.event==='pull_request'&&r.executionRevision==='UNRESOLVED_PR_MERGE_WORKFLOW').length,175);
 assert.equal(c.filter(r=>r.workflowPath==='.github/workflows/q01-reliability.yml').length,335);
 assert.equal(c.filter(r=>r.workflowPath==='.github/workflows/adminit-synthetic-containment.yml').length,35);
});
test('no snapshot-only candidate is a verified cancellation decision',()=>{
 for(const r of runs.filter(r=>r.proposedCancellation)){
  assert.equal(r.attempt>=1,true);
  assert.match(r.headSha,/^[a-f0-9]{40}$/);
  assert.equal(typeof r.url,'string');
  // A queued workflow may already contain successful jobs and uploaded artifacts.
  // Snapshot-only data lacks live job, artifact, and executed workflow revision checks.
  assert.equal(Object.hasOwn(r,'approvedCancellation'),false);
 }
});
