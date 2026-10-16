import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
import {createIngestionJobStore} from '../src/ingestion-job-postgres.mjs';
import {createFencedIngestionJobStore} from '../src/ingestion-job-postgres-fenced.mjs';
import {normalizePostgresIngestionLease} from '../src/ingestion-lease-contract.mjs';
import {createIngestionWorker} from '../src/ingestion-worker.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const migrations=['001_adapter_snapshots.sql','002_ingestion_jobs.sql','003_ingestion_claim_fencing.sql','004_ingestion_checkpoints.sql'];

test('real PostgreSQL checkpoint survives killed worker; every stale operation is fenced',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool,schema})=>{
  await applyMathMigrations(pool);const store=createFencedIngestionJobStore(pool),legacy=createIngestionJobStore(pool);
  const provenance={source:{hash64hex:'a'.repeat(64),edition:'synthetic-1',version:'scan-1',license:'CC0 synthetic'},locator:{pdfPage1based:2,printedPage:'i',region:[0,0,1,1]},extractionVersion:'pipeline-1',textHash64hex:'b'.repeat(64)};
  const checkpoint={schemaVersion:'book-checkpoint/v1',provenance,candidate:{status:'untested'},stage:'review_required',reviewReceipt:null};
  const job=await legacy.enqueue({kind:'extract-pages',sourceHash:provenance.source.hash64hex,locator:'checkpoint-'+randomUUID(),payload:{provenance,scope:{allowExternalProcessing:false}}});
  const id=Number(job.job_id);
  const child=spawn(process.execPath,[fileURLToPath(new URL('./fixtures/postgres-checkpoint-worker.mjs',import.meta.url))],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,MATH_UNIVERSE_TEST_DATABASE_URL:url,MU_TEST_SCHEMA:schema,MU_TEST_JOB_ID:String(id),MU_TEST_CHECKPOINT:JSON.stringify(checkpoint)}});
  let timer;const exit=once(child,'exit');
  try{
   await new Promise((resolve,reject)=>{
    let output='';timer=setTimeout(()=>reject(Error('Checkpoint worker deadline')),15000);
    child.stdout.on('data',part=>{output+=part.toString();if(output.includes('CHECKPOINT_COMMITTED'))resolve()});
    child.on('error',()=>reject(Error('Checkpoint worker unavailable')));child.on('exit',()=>reject(Error('Checkpoint worker exited before acknowledgement')));
   });clearTimeout(timer);
   const first=(await pool.query('SELECT * FROM mu_ingestion_jobs WHERE job_id=$1',[id])).rows[0];
   assert.deepEqual(first.checkpoint,checkpoint);child.kill('SIGKILL');await exit;
   await pool.query("UPDATE mu_ingestion_jobs SET lease_until=now()-interval '1 second' WHERE job_id=$1",[id]);
   const claims=await Promise.all([store.claim({workerId:'crash-worker',jobId:id,leaseSeconds:10}),store.claim({workerId:'crash-worker',jobId:id,leaseSeconds:10})]);
   assert.equal(claims.filter(Boolean).length,1);const fresh=claims.find(Boolean);
   assert.notEqual(fresh.claim_token,first.claim_token);assert.deepEqual(fresh.checkpoint,checkpoint);
   const normalized=normalizePostgresIngestionLease(fresh);assert.deepEqual(normalized.checkpoint,checkpoint);assert.deepEqual(normalized.payload.provenance,provenance);
   const stale={jobId:id,workerId:'crash-worker',claimToken:first.claim_token};
   for(const operation of [()=>store.renew(stale),()=>store.checkpoint({...stale,checkpoint:{forged:true}}),()=>store.complete({...stale,result:{forged:true}}),()=>store.fail({...stale,error:'STALE'})])await assert.rejects(operation,/expired or not owned/);
   const current={jobId:id,workerId:'crash-worker',claimToken:fresh.claim_token};
   await store.renew({...current,leaseSeconds:20});
   await store.complete({...current,result:{...checkpoint,scope:normalized.payload.scope}});
   const saved=(await pool.query('SELECT * FROM mu_ingestion_jobs WHERE job_id=$1',[id])).rows[0];
   assert.equal(saved.state,'completed');assert.equal(saved.result.stage,'review_required');assert.equal(saved.result.reviewReceipt,null);assert.equal(saved.result.candidate.status,'untested');assert.deepEqual(saved.result.provenance,provenance);assert.equal(saved.result.scope.allowExternalProcessing,false);
  }finally{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exit}}
 });
});

test('real PostgreSQL migrations serialize, rollback fully and preserve legacy API',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  // Headers before BEGIN must not release the outer transaction/advisory lock.
  await assert.rejects(applyMathMigrations(pool,{readSql:async name=>name==='004_ingestion_checkpoints.sql'?'SELECT missing_migration_function();':readFile(new URL('../sql/'+name,import.meta.url),'utf8')}));
  const objects=await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename LIKE 'mu_%'");assert.deepEqual(objects.rows,[],'All DDL and ledger writes must roll back');
  const results=await Promise.all([applyMathMigrations(pool),applyMathMigrations(pool)]);
  assert.equal(results.filter(r=>r.length===4).length,1);assert.equal(results.filter(r=>r.length===0).length,1);
  assert.deepEqual((await pool.query('SELECT filename FROM mu_schema_migrations ORDER BY filename')).rows.map(r=>r.filename),migrations);
  const legacy=createIngestionJobStore(pool),fenced=createFencedIngestionJobStore(pool);
  const job=await legacy.enqueue({kind:'verify-candidate',sourceHash:randomUUID(),locator:'legacy'});
  const lease=await legacy.claim({workerId:'legacy',leaseSeconds:10});await legacy.complete({jobId:Number(lease.job_id),workerId:'legacy',result:{legacy:true}});
  assert.equal(String(job.job_id),String(lease.job_id));
  const exhausted=await legacy.enqueue({kind:'verify-candidate',sourceHash:randomUUID(),locator:'exhausted'});
  const active=await fenced.claim({workerId:'fenced',jobId:Number(exhausted.job_id),leaseSeconds:10});
  await pool.query("UPDATE mu_ingestion_jobs SET attempts=max_attempts,lease_until=now()-interval '1 second' WHERE job_id=$1",[active.job_id]);
  assert.equal(await fenced.claim({workerId:'other',jobId:Number(active.job_id)}),null);
  const state=(await pool.query('SELECT state,claim_token,worker_id,lease_until FROM mu_ingestion_jobs WHERE job_id=$1',[active.job_id])).rows[0];
  assert.deepEqual(state,{state:'failed',claim_token:null,worker_id:null,lease_until:null});
 });
});

test('real PostgreSQL generic worker resumes fenced checkpoint and supports legacy bigint IDs',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  await applyMathMigrations(pool);const fenced=createFencedIngestionJobStore(pool),legacy=createIngestionJobStore(pool);
  const payload={sourceHash:'c'.repeat(64),edition:'synthetic',page:1,allowExternalProcessing:false};
  const job=await legacy.enqueue({kind:'verify-candidate',sourceHash:payload.sourceHash,locator:randomUUID(),payload});
  const first=await fenced.claim({workerId:'reused',jobId:Number(job.job_id),leaseSeconds:10});
  const prior={stage:'review_required',provenance:payload,step:1};
  await fenced.checkpoint({jobId:first.job_id,workerId:'reused',claimToken:first.claim_token,checkpoint:prior});
  await fenced.fail({jobId:first.job_id,workerId:'reused',claimToken:first.claim_token,error:'INTERRUPTED',retrySeconds:1});
  await pool.query('UPDATE mu_ingestion_jobs SET available_at=now() WHERE job_id=$1',[first.job_id]);
  const errors=[];let save;
  const worker=createIngestionWorker({store:fenced,workerId:'reused',heartbeatMs:100,leaseSeconds:10,onError:e=>errors.push(e),handlers:{'verify-candidate':async(data,context)=>{
   assert.deepEqual(data,payload);assert.deepEqual(context.checkpoint,prior);assert.equal(context.attempt,2);assert.equal(typeof context.jobId,'number');save=context.saveCheckpoint;
   await save({...prior,step:2});await new Promise(r=>setTimeout(r,150));return {stage:'review_required',status:'untested',provenance:data};
  }}});
  await worker.tick();worker.stop();await worker.drain();assert.deepEqual(errors,[]);
  await assert.rejects(save({invalid:true}));
  const stored=(await pool.query('SELECT state,result,checkpoint FROM mu_ingestion_jobs WHERE job_id=$1',[job.job_id])).rows[0];
  assert.equal(stored.state,'completed');assert.equal(stored.result.status,'untested');assert.deepEqual(stored.checkpoint,{...prior,step:2});
  const other=await legacy.enqueue({kind:'verify-candidate',sourceHash:randomUUID(),locator:'legacy-worker'});
  const legacyErrors=[];const oldWorker=createIngestionWorker({store:legacy,workerId:'legacy-worker',onError:e=>legacyErrors.push(e),handlers:{'verify-candidate':async(_data,context)=>{assert.equal(context.jobId,Number(other.job_id));assert.equal(context.checkpoint,null);return {legacy:true}}}});
  await oldWorker.tick();oldWorker.stop();await oldWorker.drain();assert.deepEqual(legacyErrors,[]);
  assert.equal((await pool.query('SELECT state FROM mu_ingestion_jobs WHERE job_id=$1',[other.job_id])).rows[0].state,'completed');
 });
});
