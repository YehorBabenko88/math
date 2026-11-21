import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngestionJobStore} from '../src/ingestion-job-postgres.mjs';
test('renewal is parameterized and requires same worker and active lease',async()=>{
 const calls=[];
 const store=createIngestionJobStore({async query(sql,args){calls.push({sql,args});return {rows:[{job_id:9,lease_until:'future'}]}}});
 const renewed=await store.renew({jobId:9,workerId:'worker-a',leaseSeconds:90});
 assert.equal(renewed.job_id,9);
 assert.deepEqual(calls[0].args,[9,'worker-a',90]);
 assert.match(calls[0].sql,/worker_id=\$2 AND lease_until>now\(\)/);
});
test('renewal rejects invalid durations and lost ownership',async()=>{
 const store=createIngestionJobStore({async query(){return {rows:[]}}});
 await assert.rejects(store.renew({jobId:9,workerId:'a',leaseSeconds:0}),/Invalid lease renewal/);
 await assert.rejects(store.renew({jobId:9,workerId:'a'}),/expired or not owned/);
});
