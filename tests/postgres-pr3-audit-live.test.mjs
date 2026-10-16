import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
import {createIngestionJobStore} from '../src/ingestion-job-postgres.mjs';
import {createFencedIngestionJobStore} from '../src/ingestion-job-postgres-fenced.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;

test('real PostgreSQL rejects unsafe bigint claims without changing their state',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  await applyMathMigrations(pool);
  const id='9007199254740993';
  await pool.query("INSERT INTO mu_ingestion_jobs(job_id,kind,idempotency_key,payload) OVERRIDING SYSTEM VALUE VALUES ($1,'verify-candidate',$2,'{}'::jsonb)",[id,'d'.repeat(64)]);
  const store=createFencedIngestionJobStore(pool);
  assert.equal(await store.claim({workerId:'bounded-worker'}),null);
  const row=(await pool.query('SELECT state,attempts,claim_token FROM mu_ingestion_jobs WHERE job_id=$1',[id])).rows[0];
  assert.deepEqual(row,{state:'queued',attempts:0,claim_token:null});
 });
});

test('real PostgreSQL stores inert review results and fences every expired write',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  await applyMathMigrations(pool);
  const legacy=createIngestionJobStore(pool),store=createFencedIngestionJobStore(pool);
  const job=await legacy.enqueue({kind:'verify-candidate',sourceHash:randomUUID(),locator:'audit'});
  const lease=await store.claim({workerId:'audit',jobId:Number(job.job_id)});
  const owner={jobId:lease.job_id,workerId:'audit',claimToken:lease.claim_token};
  let calls=0;
  await assert.rejects(store.complete({...owner,result:{get content(){calls++;return 'untrusted'}}}));
  await assert.rejects(store.complete({...owner,result:{text:'x'.repeat(256*1024)}}));
  await assert.rejects(store.checkpoint({...owner,checkpoint:{value:Infinity}}));
  assert.equal(calls,0);
  const result={status:'untested',review:'review_required',reviewReceipt:null,provenance:{version:'synthetic-1',page:3},allowExternalProcessing:false};
  await store.checkpoint({...owner,checkpoint:result});
  await pool.query("UPDATE mu_ingestion_jobs SET lease_until=now()-interval '1 second' WHERE job_id=$1",[owner.jobId]);
  for(const operation of [()=>store.renew(owner),()=>store.checkpoint({...owner,checkpoint:{}}),()=>store.complete({...owner,result}),()=>store.fail({...owner,error:'failure'})])await assert.rejects(operation,{code:'JOB_LEASE_LOST'});
  const next=await store.claim({workerId:'audit',jobId:owner.jobId});
  assert.deepEqual(next.checkpoint,result);
  await store.complete({...owner,claimToken:next.claim_token,result});
  assert.deepEqual((await pool.query('SELECT result FROM mu_ingestion_jobs WHERE job_id=$1',[owner.jobId])).rows[0].result,result);
 });
});

test('real PostgreSQL migration lexer preserves nested comments and function bodies',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  const script='\uFEFF/* outer /* nested */ COMMIT; */\nBEGIN;\nCREATE FUNCTION audit_literal() RETURNS text LANGUAGE plpgsql AS $body$ BEGIN RETURN \'COMMIT; -- inert\'; END; $body$;\nCOMMIT; -- COMMIT;\n';
  const readSql=async name=>name.startsWith('001')?script:'SELECT 1;';
  const results=await Promise.all([applyMathMigrations(pool,{readSql}),applyMathMigrations(pool,{readSql})]);
  assert.deepEqual(results.map(r=>r.length).sort(),[0,4]);
  assert.equal((await pool.query('SELECT audit_literal() AS value')).rows[0].value,'COMMIT; -- inert');
  assert.deepEqual(await applyMathMigrations(pool,{readSql}),[]);
 });
});
