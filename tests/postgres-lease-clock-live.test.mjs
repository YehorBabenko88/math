import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
import {enableFencedIngestionService} from '../src/ingestion-service.mjs';
import {createIngestionJobStore} from '../src/ingestion-job-postgres.mjs';
import {createFencedIngestionJobStore} from '../src/ingestion-job-postgres-fenced.mjs';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const methods=['complete','renew','checkpoint','fail'];
for(const lock of ['advisory','row','protocol-row'])test(`real PostgreSQL: fenced operations reject expiry after ${lock} lock wait`,{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  pool.options.max=12;
  await applyMathMigrations(pool);await enableFencedIngestionService(pool);
  const queue=createIngestionJobStore(pool),store=createFencedIngestionJobStore(pool),leases=[];
  for(const method of methods){const job=await queue.enqueue({kind:'verify-candidate',sourceHash:randomUUID(),locator:method});leases.push(await store.claim({workerId:'clock',leaseSeconds:10,jobId:Number(job.job_id)}));}
  const queued=await queue.enqueue({kind:'verify-candidate',sourceHash:randomUUID(),locator:'claim'});
  // Public claims use the required minimum ten-second lease. Shorten only these
  // owned fixture rows under their valid capabilities, so global lock contention
  // stays below one second in the parallel full suite (the external RED probe
  // retains the public ten-second/eleven-second reproduction).
  const setup=await pool.connect();try{
   for(const lease of leases){await setup.query('BEGIN');await setup.query("SELECT set_config('math_universe.claim_token',$1,true)",[lease.claim_token]);const row=await setup.query("UPDATE mu_ingestion_jobs SET lease_until=clock_timestamp()+interval '500 milliseconds' WHERE job_id=$1 RETURNING lease_until",[lease.job_id]);lease.lease_until=row.rows[0].lease_until;await setup.query('COMMIT');}
  }finally{setup.release();}
  const blocker=await pool.connect();let pending=[];
  try{
   await blocker.query('BEGIN');
   if(lock==='advisory')await blocker.query('SELECT pg_advisory_xact_lock(732814,3)');
   else if(lock==='protocol-row')await blocker.query('SELECT singleton FROM mu_ingestion_protocol FOR UPDATE');
   else await blocker.query('SELECT job_id FROM mu_ingestion_jobs WHERE job_id=ANY($1::bigint[]) FOR UPDATE',[leases.map(x=>x.job_id)]);
   pending=methods.map((method,i)=>store[method]({jobId:leases[i].job_id,workerId:'clock',claimToken:leases[i].claim_token,checkpoint:{stage:'blocked'},result:{blocked:true},error:'blocked'}).then(value=>({value}),error=>({code:error.code})));
   if(lock==='advisory')pending.push(store.claim({workerId:'clock',leaseSeconds:10,jobId:Number(queued.job_id)}).then(value=>({value})));
   else if(lock==='row')assert.equal(await store.claim({workerId:'other',jobId:leases[0].job_id}),null,'claim skips row locked by another transaction');
   await delay(750);
   const witness=(await blocker.query('SELECT clock_timestamp() AS time')).rows[0].time;
   assert.ok(leases.every(x=>witness>x.lease_until),'all leases expired before unlocking');
   await blocker.query('COMMIT');
   const outcomes=await Promise.all(pending);
   for(const [i,method] of methods.entries())assert.equal(outcomes[i].code,'JOB_LEASE_LOST',`${method} must reject expired ownership after ${lock} wait: ${JSON.stringify(outcomes)}`);
   const states=(await pool.query('SELECT state,result,checkpoint FROM mu_ingestion_jobs WHERE job_id=ANY($1::bigint[])',[leases.map(x=>x.job_id)])).rows;
   assert.ok(states.every(x=>x.state==='running'&&x.result===null&&x.checkpoint===null));
   if(lock==='advisory')assert.ok(outcomes[4].value.lease_until-witness>=9500,'acquisition lease starts after lock wait');
   const reacquired=await Promise.all([store.claim({workerId:'clock',jobId:leases[0].job_id}),store.claim({workerId:'clock',jobId:leases[0].job_id})]);
   assert.equal(reacquired.filter(Boolean).length,1);
   const fresh=reacquired.find(Boolean);assert.notEqual(fresh.claim_token,leases[0].claim_token);
   await assert.rejects(store.complete({jobId:fresh.job_id,workerId:'clock',claimToken:leases[0].claim_token}),{code:'JOB_LEASE_LOST'});
   const completions=await Promise.allSettled([store.complete({jobId:fresh.job_id,workerId:'clock',claimToken:fresh.claim_token}),store.complete({jobId:fresh.job_id,workerId:'clock',claimToken:fresh.claim_token})]);
   assert.equal(completions.filter(x=>x.status==='fulfilled').length,1);assert.equal(completions.find(x=>x.status==='rejected').reason.code,'JOB_LEASE_LOST');
  }finally{await blocker.query('ROLLBACK');blocker.release();await Promise.allSettled(pending);}
 });
});


test('real PostgreSQL: SQL006 guard rejects direct completion at transaction-clock expiry boundary',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  await applyMathMigrations(pool);
  await createIngestionJobStore(pool).enqueue({kind:'verify-candidate',sourceHash:randomUUID(),locator:'boundary'});
  const store=createFencedIngestionJobStore(pool),lease=await store.claim({workerId:'boundary'}),c=await pool.connect();
  try{
   await c.query('BEGIN');
   // Build exact boundary in legacy fixture mode, then exercise the real fenced
   // guard in the same transaction. now() equals OLD.lease_until exactly, while
   // wall time is already later. No local timestamp rounding is involved.
   await c.query('UPDATE mu_ingestion_jobs SET lease_until=now() WHERE job_id=$1',[lease.job_id]);
   assert.equal((await c.query('SELECT lease_until=now() AS boundary FROM mu_ingestion_jobs WHERE job_id=$1',[lease.job_id])).rows[0].boundary,true);
   await c.query("UPDATE mu_ingestion_protocol SET mode='fenced'");
   await c.query("SELECT set_config('math_universe.claim_token',$1,true)",[lease.claim_token]);
   await assert.rejects(c.query("UPDATE mu_ingestion_jobs SET state='completed',claim_token=NULL,worker_id=NULL,lease_until=NULL WHERE job_id=$1 AND lease_until=now()",[lease.job_id]),{code:'MU001'});
  }finally{await c.query('ROLLBACK');c.release();}
  assert.equal((await pool.query('SELECT state FROM mu_ingestion_jobs WHERE job_id=$1',[lease.job_id])).rows[0].state,'running');
  assert.equal((await pool.query('SELECT mu_ingestion_protocol_status() AS mode')).rows[0].mode,'legacy');
 });
});
