import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngestionJobStore} from '../src/ingestion-job-postgres.mjs';
test('ingestion queue uses deterministic idempotency and SQL parameters',async()=>{
 const calls=[];const pool={async query(sql,args){calls.push({sql,args});return {rows:[{job_id:1,state:'queued',idempotency_key:args[0]}]}}};
 const q=createIngestionJobStore(pool);
 const input={kind:'extract-pages',sourceHash:'abc',locator:'p1-10',payload:{page:1}};
 const a=await q.enqueue(input),b=await q.enqueue(input);
 assert.equal(a.idempotency_key,b.idempotency_key);
 assert.equal(a.idempotency_key.length,64);
 assert.match(calls[0].sql,/ON CONFLICT/);
 assert.equal(calls[0].args[1],'extract-pages');
});
test('claims lock rows and completions enforce lease ownership',async()=>{
 const calls=[];const pool={async query(sql,args){calls.push({sql,args});return {rows:[{job_id:1,kind:'extract-pages'}]}}};
 const q=createIngestionJobStore(pool);
 await q.claim({workerId:'worker-1'});
 assert.match(calls[0].sql,/FOR UPDATE SKIP LOCKED/);
 assert.match(calls[0].sql,/lease_until<now\(\)/);
 await q.complete({jobId:1,workerId:'worker-1',result:{pages:10}});
 assert.match(calls[1].sql,/worker_id=\$2/);
 await q.fail({jobId:1,workerId:'worker-1',error:'transient'});
 assert.match(calls[2].sql,/attempts>=max_attempts/);
});
test('queue rejects unknown job kinds and invalid leases',async()=>{
 const q=createIngestionJobStore({async query(){return {rows:[]}}});
 await assert.rejects(q.enqueue({kind:'execute-shell',sourceHash:'abc',locator:'p1'}),/Invalid job kind/);
 await assert.rejects(q.claim({workerId:'x',leaseSeconds:0}),/Invalid lease/);
 await assert.rejects(q.complete({jobId:1,workerId:'x'}),/lease expired/);
});
