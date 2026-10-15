import test from 'node:test';
import assert from 'node:assert/strict';
import {createFencedIngestionJobStore} from '../src/ingestion-job-postgres-fenced.mjs';
const old='11111111-1111-4111-8111-111111111111';
const fresh='22222222-2222-4222-8222-222222222222';
test('claim issues a per-acquisition UUID and returns token',async()=>{
 let params;
 const store=createFencedIngestionJobStore({async query(sql,p){params=p;assert.match(sql,/claim_token=\$3::uuid/);return {rows:[{job_id:1,claim_token:p[2]}]}}});
 const job=await store.claim({workerId:'same'});
 assert.equal(job.claim_token,params[2]);assert.notEqual(job.claim_token,old);
});
test('renew and complete require matching token in SQL predicate',async()=>{
 const statements=[];
 const store=createFencedIngestionJobStore({async query(sql,args){statements.push({sql,args});return {rows:[]}}});
 await assert.rejects(store.renew({jobId:1,workerId:'same',claimToken:old}),/expired or not owned/);
 await assert.rejects(store.complete({jobId:1,workerId:'same',claimToken:old}),/expired or not owned/);
 await assert.rejects(store.fail({jobId:1,workerId:'same',claimToken:old,error:'fail'}),/expired or not owned/);
 assert.equal(statements.length,3);
 for(const {sql,args} of statements){assert.match(sql,/claim_token=\$3::uuid/);assert.equal(args[2],old)}
});
test('stale token cannot complete a new lease, even with same worker ID',async()=>{
 const store=createFencedIngestionJobStore({async query(sql,args){
  if(sql.includes('UPDATE mu_ingestion_jobs SET state=\'completed\''))return {rows:args[2]===fresh?[{job_id:1}]:[]};
  return {rows:[]};
 }});
 await assert.rejects(store.complete({jobId:1,workerId:'same',claimToken:old}),/expired or not owned/);
 assert.deepEqual(await store.complete({jobId:1,workerId:'same',claimToken:fresh}),{job_id:1});
});
test('missing claim token fails before database access',async()=>{
 const store=createFencedIngestionJobStore({async query(){throw Error('must not query')}});
 await assert.rejects(store.complete({jobId:1,workerId:'same',result:{}}),/claim token/);
});
