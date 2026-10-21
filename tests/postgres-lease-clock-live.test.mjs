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
// Observe server-side waits, not elapsed client time. Clear the statistics snapshot
// on every sample because the observer is itself inside the blocker transaction.
async function waitForDatabase(client,query,values,accept){
 const until=Date.now()+5000;let rows;
 do{await client.query('SELECT pg_stat_clear_snapshot()');rows=(await client.query(query,values)).rows;if(accept(rows))return rows;await delay(10);}while(Date.now()<until);
 assert.fail(`PostgreSQL witness not established: ${JSON.stringify(rows)}`);
}
function assertLeaseWait(row,blockerPid){
 assert.equal(row.state,'active');assert.equal(row.wait_event_type,'Lock');
 assert.ok(Array.isArray(row.blocker_path)&&row.blocker_path.length>=2,'server must prove a blocking path');
 assert.equal(row.blocker_path[0],row.pid);assert.equal(row.blocker_path.at(-1),blockerPid,'blocking chain must reach the fixture');
 assert.ok(row.blockers.includes(row.blocker_path[1]),'first chain edge must be a direct database blocker');
 assert.equal(row.valid,true,'lease must still be valid while backend is already waiting');
}
test('lock witness rejects late-start, unrelated and non-waiting operations',()=>{
 const valid={pid:7,state:'active',wait_event_type:'Lock',blockers:[42],blocker_path:[7,42],valid:true};
 assert.doesNotThrow(()=>assertLeaseWait({...valid,blockers:[43],blocker_path:[7,43,42]},42));
 assert.doesNotThrow(()=>assertLeaseWait(valid,42));
 for(const patch of [{valid:false},{blockers:[43]},{blocker_path:[7,43,99]},{blocker_path:null},{blocker_path:[8,42]},{wait_event_type:null},{state:'idle'}])assert.throws(()=>assertLeaseWait({...valid,...patch},42));
});
test('real PostgreSQL: sub-millisecond expiry cannot be proved by JavaScript Date',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  const {rows:[row]}=await pool.query(`SELECT
   '2026-01-01 00:00:00.123100+00'::timestamptz AS deadline,
   '2026-01-01 00:00:00.123900+00'::timestamptz AS observed,
   '2026-01-01 00:00:00.123900+00'::timestamptz > '2026-01-01 00:00:00.123100+00'::timestamptz AS expired`);
  assert.equal(row.expired,true);assert.equal(row.observed.getTime(),row.deadline.getTime());
 });
});
for(const lock of ['advisory','row','protocol-row','protocol-row-interposed'])test(`real PostgreSQL: fenced operations reject expiry after ${lock} lock wait`,{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  pool.options.max=12;
  await applyMathMigrations(pool);await enableFencedIngestionService(pool);
  const queue=createIngestionJobStore(pool),store=createFencedIngestionJobStore(pool),leases=[];
  for(const method of methods){const job=await queue.enqueue({kind:'verify-candidate',sourceHash:randomUUID(),locator:method});leases.push(await store.claim({workerId:'clock',leaseSeconds:10,jobId:Number(job.job_id)}));}
  const queued=await queue.enqueue({kind:'verify-candidate',sourceHash:randomUUID(),locator:'claim'});
  // Public claims use the required minimum ten-second lease. Shorten only these
  // owned fixture rows under valid capabilities. Reserve connections first so
  // connection establishment cannot consume the short witness window. The
  // external probe retains the public ten-second/eleven-second reproduction.
  const clients=await Promise.all(Array.from({length:methods.length+(lock==='advisory'?1:0)},()=>pool.connect()));
  const pendingPids=clients.map(c=>c.processID);
  assert.equal(new Set(pendingPids).size,clients.length);
  const blocker=await pool.connect();const interloper=lock==='protocol-row-interposed'?await pool.connect():null;let interposition;let pending=[];
  try{
  const setup=await pool.connect();try{
   for(const lease of leases){await setup.query('BEGIN');await setup.query("SELECT set_config('math_universe.claim_token',$1,true)",[lease.claim_token]);const row=await setup.query("UPDATE mu_ingestion_jobs SET lease_until=clock_timestamp()+interval '2 seconds' WHERE job_id=$1 RETURNING lease_until",[lease.job_id]);lease.lease_until=row.rows[0].lease_until;await setup.query('COMMIT');}
  }finally{setup.release();}
   await blocker.query('BEGIN');
   if(lock==='advisory')await blocker.query('SELECT pg_advisory_xact_lock(732814,3)');
   else if(lock.startsWith('protocol-row'))await blocker.query('SELECT singleton FROM mu_ingestion_protocol FOR UPDATE');
   else await blocker.query('SELECT job_id FROM mu_ingestion_jobs WHERE job_id=ANY($1::bigint[]) FOR UPDATE',[leases.map(x=>x.job_id)]);
   const start=(method,i)=>createFencedIngestionJobStore({connect:async()=>({query:clients[i].query.bind(clients[i]),release(){}})})[method]({jobId:leases[i].job_id,workerId:'clock',claimToken:leases[i].claim_token,checkpoint:{stage:'blocked'},result:{blocked:true},error:'blocked'}).then(value=>({value}),error=>({code:error.code}));
   if(interloper){
    pending=methods.slice(0,2).map(start);
    await waitForDatabase(blocker,'SELECT pid,state,wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=ANY($1::int[])',[pendingPids.slice(0,2)],rows=>rows.length===2&&rows.every(r=>r.state==='active'&&r.wait_event_type==='Lock'&&r.blockers.includes(blocker.processID)));
    await interloper.query('BEGIN');
    interposition=interloper.query('SELECT pg_advisory_xact_lock(732814,3)').then(()=>interloper.query('COMMIT'));
    await waitForDatabase(blocker,'SELECT pid,state,wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1',[interloper.processID],rows=>rows.length===1&&rows[0].state==='active'&&rows[0].wait_event_type==='Lock'&&pendingPids.slice(0,2).every(pid=>rows[0].blockers.includes(pid)));
    pending.push(...methods.slice(2).map((method,i)=>start(method,i+2)));
   }else pending=methods.map(start);
   if(lock==='advisory')pending.push(createFencedIngestionJobStore({connect:async()=>({query:clients[4].query.bind(clients[4]),release(){}})}).claim({workerId:'clock',leaseSeconds:10,jobId:Number(queued.job_id)}).then(value=>({value})));
   else if(lock==='row')assert.equal(await store.claim({workerId:'other',jobId:leases[0].job_id}),null,'claim skips row locked by another transaction');
   assert.equal(pendingPids.length,methods.length+(lock==='advisory'?1:0),'every pending operation has a dedicated backend PID');
   // A queued exclusive advisory request can become an intermediate blocker.
   // Prove actual server edges reach our fixture instead of requiring one hop.
   const observations=await waitForDatabase(blocker,`
    WITH RECURSIVE blocking(origin,pid,path) AS (
     SELECT pid,pid,ARRAY[pid] FROM unnest($1::int[]) AS pid
     UNION ALL
     SELECT b.origin,next_pid,b.path||next_pid FROM blocking b
     CROSS JOIN LATERAL unnest(pg_blocking_pids(b.pid)) AS next_pid
     WHERE NOT next_pid=ANY(b.path)
    )
    SELECT a.pid,a.state,a.wait_event_type,pg_blocking_pids(a.pid) AS blockers,
           (SELECT path FROM blocking WHERE origin=a.pid AND pid=$3
            ORDER BY CASE WHEN $4::int=ANY(path) THEN 0 ELSE 1 END LIMIT 1) AS blocker_path,
           j.lease_until>clock_timestamp() AS valid
    FROM pg_stat_activity a LEFT JOIN mu_ingestion_jobs j
      ON j.job_id=(($2::bigint[])[array_position($1::int[],a.pid)])
    WHERE a.pid=ANY($1::int[])`,[pendingPids,leases.map(x=>x.job_id),blocker.processID,interloper?.processID??null],
    rows=>rows.length===pendingPids.length&&rows.every(r=>r.state==='active'&&r.wait_event_type==='Lock'&&r.blocker_path?.at(-1)===blocker.processID));
   if(interloper)for(const row of observations.filter(r=>pendingPids.slice(2).includes(r.pid))){
    assert.ok(row.blockers.includes(interloper.processID),'last operations must directly wait behind queued exclusive request');
    assert.ok(row.blocker_path.includes(interloper.processID),'actual chain must include the interposed request');
   }
   for(const row of observations){
    if(row.pid===pendingPids[4]){assert.equal(row.wait_event_type,'Lock');continue;}
    assertLeaseWait(row,blocker.processID);
   }
   if(lock==='advisory')assert.equal((await blocker.query("SELECT count(*)::int AS n FROM pg_locks WHERE pid=ANY($1::int[]) AND locktype='advisory' AND classid=732814 AND objid=3 AND NOT granted",[pendingPids])).rows[0].n,pendingPids.length);
   // Retain the original strict JS Date assertion below: PostgreSQL has
   // microsecond precision, whereas pg exposes Date with millisecond precision.
   // Establish a DB-clock margin instead of sleeping or rounding the deadline.
   await waitForDatabase(blocker,"SELECT lease_until+interval '1 millisecond'<clock_timestamp() AS expired FROM mu_ingestion_jobs WHERE job_id=ANY($1::bigint[])",[leases.map(x=>x.job_id)],rows=>rows.length===methods.length&&rows.every(r=>r.expired));
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
  }finally{try{await blocker.query('ROLLBACK');}finally{blocker.release();await Promise.allSettled(pending);if(interloper){try{await interposition;await interloper.query('ROLLBACK')}finally{interloper.release()}}for(const client of clients)client.release();}}
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
