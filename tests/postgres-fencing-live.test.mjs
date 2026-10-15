// Opt-in integration test: disposable, empty PostgreSQL database only.
// This test runs separately from the existing smoke test to avoid shared state.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
import {createIngestionJobStore} from '../src/ingestion-job-postgres.mjs';
import {createFencedIngestionJobStore} from '../src/ingestion-job-postgres-fenced.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
test('real PostgreSQL: same worker cannot finalize stale claim after reclaim',{skip:!url},async()=>{
 const {default:pg}=await import('pg');
 const pool=new pg.Pool({connectionString:url,max:3,connectionTimeoutMillis:5000});
 try{
  // The existing smoke test and this test share the same database in CI.
  // Migration runner is serialized via advisory lock and is idempotent.
  await applyMathMigrations(pool);
  const q=createIngestionJobStore(pool), fenced=createFencedIngestionJobStore(pool);
  const sourceHash=randomUUID();
  const record=await q.enqueue({kind:'verify-candidate',sourceHash,locator:'fencing-'+randomUUID()});
  const first=await fenced.claim({workerId:'reused-worker',leaseSeconds:10});
  assert.ok(first,'Expected fenced claim');
  assert.equal(String(first.job_id),String(record.job_id));
  assert.ok(first.claim_token);
  await pool.query("UPDATE mu_ingestion_jobs SET lease_until=now()-interval '1 second' WHERE job_id=$1",[first.job_id]);
  const second=await fenced.claim({workerId:'reused-worker',leaseSeconds:10});
  assert.equal(String(second.job_id),String(first.job_id));
  assert.notEqual(second.claim_token,first.claim_token);
  await assert.rejects(fenced.renew({jobId:Number(first.job_id),workerId:'reused-worker',claimToken:first.claim_token}),/expired or not owned/);
  await assert.rejects(fenced.complete({jobId:Number(first.job_id),workerId:'reused-worker',claimToken:first.claim_token,result:{stale:true}}),/expired or not owned/);
  await assert.rejects(fenced.fail({jobId:Number(first.job_id),workerId:'reused-worker',claimToken:first.claim_token,error:'stale'}),/expired or not owned/);
  await fenced.complete({jobId:Number(second.job_id),workerId:'reused-worker',claimToken:second.claim_token,result:{accepted:true}});
  const result=await pool.query('SELECT state,result FROM mu_ingestion_jobs WHERE job_id=$1',[second.job_id]);
  assert.equal(result.rows[0].state,'completed');
  assert.deepEqual(result.rows[0].result,{accepted:true});
 }finally{await pool.end()}
});
