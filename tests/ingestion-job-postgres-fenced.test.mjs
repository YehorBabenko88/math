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

test('claim returns checkpoint and owner, isolates optional job and recovers exact-expiry exhausted leases',async()=>{
 const calls=[];const store=createFencedIngestionJobStore({async query(sql,args){calls.push({sql,args});return {rows:[{job_id:'42',worker_id:'worker',checkpoint:{stage:'candidate'},claim_token:args[2]}]}}});
 const job=await store.claim({workerId:'worker',jobId:42});
 assert.equal(job.job_id,42);assert.equal(job.worker_id,'worker');assert.deepEqual(job.checkpoint,{stage:'candidate'});
 const {sql,args}=calls[0];assert.equal(args[3],42);assert.match(sql,/\$4::bigint/);assert.match(sql,/lease_until<=now\(\)/);assert.match(sql,/attempts>=max_attempts/);assert.match(sql,/state='failed'/);assert.match(sql,/claim_token=NULL/);assert.match(sql,/worker_id=NULL/);assert.match(sql,/lease_until=NULL/);assert.match(sql,/RETURNING[\s\S]*job\.checkpoint/);assert.match(sql,/RETURNING[\s\S]*job\.worker_id/);
 await store.claim({workerId:'worker'});assert.equal(calls[1].args[3],null);
 for(const jobId of [0,-1,1.5,'42',Number.MAX_SAFE_INTEGER+1,null])await assert.rejects(store.claim({workerId:'worker',jobId}),/job id/);
 assert.equal(calls.length,2);
});

test('checkpoint uses owner token and unexpired running lease fences and normalizes bigint result',async()=>{
 const calls=[];const store=createFencedIngestionJobStore({async query(sql,args){calls.push({sql,args});return {rows:args[2]===fresh?[{job_id:'42',checkpoint:JSON.parse(args[3])}]:[]}}});
 await assert.rejects(store.checkpoint({jobId:42,workerId:'same',claimToken:old,checkpoint:{stage:'candidate'}}),/expired or not owned/);
 const value=await store.checkpoint({jobId:42,workerId:'same',claimToken:fresh,checkpoint:{stage:'candidate',nested:[1,true,null]}});
 assert.equal(value.job_id,42);assert.equal(value.checkpoint.stage,'candidate');
 for(const {sql,args} of calls){assert.match(sql,/checkpoint=\$4::jsonb/);assert.match(sql,/job_id=\$1/);assert.match(sql,/worker_id=\$2/);assert.match(sql,/claim_token=\$3::uuid/);assert.match(sql,/state='running'/);assert.match(sql,/lease_until>now\(\)/);assert.equal(args[0],42)}
});

test('checkpoint rejects non-inert, oversized and malformed JSON before database access',async()=>{
 let queries=0,touched=0;const store=createFencedIngestionJobStore({async query(){queries++;throw Error('must not query')}});
 const cyclic={};cyclic.self=cyclic;
 const getter=Object.defineProperty({},'secret',{enumerable:true,get(){touched++;return 'secret'}});
 const hook={toJSON(){touched++;return {}}};
 const sparse=[];sparse.length=2;
 const disguisedSparse=[1];disguisedSparse.length=2;disguisedSparse[4294967295]=2;
 let deep={};for(let i=0;i<30;i++)deep={next:deep};
 for(const checkpoint of [null,[],1,'{}',undefined,{bad:NaN},{bad:Infinity},{bad:1n},{bad:undefined},{bad:()=>{}},{bad:Symbol('x')},{bad:new Date()},getter,hook,cyclic,{sparse},{disguisedSparse},deep,{huge:'x'.repeat(256*1024)},{escape:'\u0000'.repeat(50000)}]){
  await assert.rejects(store.checkpoint({jobId:1,workerId:'same',claimToken:fresh,checkpoint}),/checkpoint|JSON/i);
 }
 assert.equal(touched,0);assert.equal(queries,0);
});

test('checkpoint serializes the exact 256 KiB boundary and rejects unsafe returned bigint IDs',async()=>{
 const store=createFencedIngestionJobStore({async query(_sql,args){assert.equal(Buffer.byteLength(args[3]),256*1024);return {rows:[{job_id:'1'}]}}});
 await store.checkpoint({jobId:1,workerId:'same',claimToken:fresh,checkpoint:{x:'x'.repeat(256*1024-8)}});
 const unsafe=createFencedIngestionJobStore({async query(){return {rows:[{job_id:'9007199254740992'}]}}});
 await assert.rejects(unsafe.claim({workerId:'same'}),/job id/);
});
