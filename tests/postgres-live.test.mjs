// Opt-in real PostgreSQL smoke test. Requires an EMPTY, disposable database.
// Example: MATH_UNIVERSE_TEST_DATABASE_URL=postgres://... node --test tests/postgres-live.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
import {createIngestionJobStore} from '../src/ingestion-job-postgres.mjs';
import {createFencedIngestionJobStore} from '../src/ingestion-job-postgres-fenced.mjs';

const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
test('real PostgreSQL: migrate, deduplicate, claim, renew, complete and recover expired lease',{skip:!url},async()=>{
 const {default:pg}=await import('pg');
 const pool=new pg.Pool({connectionString:url,max:4,connectionTimeoutMillis:5000});
 try{
  // Deliberately refuse databases with existing application objects.
  const tables=await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename LIKE 'mu_%'");
  assert.equal(tables.rows.length,0,'Test database must be empty of mu_* tables');
  assert.deepEqual(await applyMathMigrations(pool),['001_adapter_snapshots.sql','002_ingestion_jobs.sql','003_ingestion_claim_fencing.sql']);
  assert.deepEqual(await applyMathMigrations(pool),[]);
  const q=createIngestionJobStore(pool);
  const sourceHash=randomUUID();
  const spec={kind:'verify-candidate',sourceHash,locator:'page-1',payload:{statement:'a=b'}};
  const first=await q.enqueue(spec);
  const duplicate=await q.enqueue(spec);
  assert.equal(String(first.job_id),String(duplicate.job_id));
  const [a,b]=await Promise.all([q.claim({workerId:'worker-a',leaseSeconds:10}),q.claim({workerId:'worker-b',leaseSeconds:10})]);
  assert.equal([a,b].filter(Boolean).length,1,'Only one worker may claim the same job');
  const claimed=a??b,owner=a?'worker-a':'worker-b';
  await q.renew({jobId:Number(claimed.job_id),workerId:owner,leaseSeconds:10});
  await assert.rejects(q.complete({jobId:Number(claimed.job_id),workerId:'intruder',result:{}}),/expired or not owned/);
  await q.complete({jobId:Number(claimed.job_id),workerId:owner,result:{verified:true}});
  assert.equal(await q.claim({workerId:'another'}),null);
  // Simulate a crashed process by expiring a second job's lease.
  await q.enqueue({kind:'extract-pages',sourceHash,locator:'page-2'});
  const crashed=await q.claim({workerId:'crashed',leaseSeconds:10});
  await pool.query("UPDATE mu_ingestion_jobs SET lease_until=now()-interval '1 second' WHERE job_id=$1",[crashed.job_id]);
  const recovered=await q.claim({workerId:'recovered',leaseSeconds:10});
  assert.equal(String(recovered.job_id),String(crashed.job_id));
  assert.equal(recovered.attempts,2);
  await assert.rejects(q.complete({jobId:Number(crashed.job_id),workerId:'crashed'}),/expired or not owned/);
  await q.complete({jobId:Number(recovered.job_id),workerId:'recovered',result:{ok:true}});
 }finally{
  // Disposable database is intentionally NOT dropped automatically.
  await pool.end();
 }
});
