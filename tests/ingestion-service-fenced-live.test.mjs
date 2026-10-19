import test from 'node:test';
import assert from 'node:assert/strict';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
import {createIngestionJobStore} from '../src/ingestion-job-postgres.mjs';
import {createFencedIngestionJobStore} from '../src/ingestion-job-postgres-fenced.mjs';
import {startIngestionService} from '../src/ingestion-service.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const live=(name,fn)=>test(name,{skip:!url},()=>withIsolatedPostgres(url,fn));
const env={MATH_UNIVERSE_DATABASE_URL:url,MATH_UNIVERSE_WORKER_ID:'same-worker',MATH_UNIVERSE_INGESTION_MODE:'fenced'};
function pgFor(pool){return async()=>({default:{Pool:class {constructor(){return {query:(...a)=>pool.query(...a),connect:()=>pool.connect(),end:async()=>{}}}}}});}
async function enable(pool){const api=await import('../src/ingestion-service.mjs');assert.equal(typeof api.enableFencedIngestionService,'function');await api.enableFencedIngestionService(pool);}
live('fenced service fails closed until explicit durable protocol activation',async({pool})=>{
 await applyMathMigrations(pool);let service;
 try{await assert.rejects(async()=>{service=await startIngestionService({env,loadPg:pgFor(pool),onError:()=>{}});},/fenced.*activat|protocol/i);}finally{await service?.stop();}
});
live('activation refuses running legacy leases and then blocks legacy claim, renew, completion and failure',async({pool})=>{
 await applyMathMigrations(pool);const legacy=createIngestionJobStore(pool);await legacy.enqueue({kind:'verify-candidate',sourceHash:'synthetic',locator:'p1'});
 const lease=await legacy.claim({workerId:'same-worker'});
 const api=await import('../src/ingestion-service.mjs');assert.equal(typeof api.enableFencedIngestionService,'function');
 await assert.rejects(api.enableFencedIngestionService(pool),/drain|running/i);
 await legacy.complete({jobId:Number(lease.job_id),workerId:'same-worker'});await enable(pool);
 await legacy.enqueue({kind:'verify-candidate',sourceHash:'synthetic',locator:'p2'});
 await assert.rejects(legacy.claim({workerId:'same-worker'}),/protocol|fenced/i);
 const fenced=createFencedIngestionJobStore(pool);const fresh=await fenced.claim({workerId:'same-worker'});
 for(const method of ['renew','complete','fail'])await assert.rejects(legacy[method]({jobId:fresh.job_id,workerId:'same-worker',error:'stale'}),/protocol|fenced/i);
 await assert.rejects(pool.query("UPDATE mu_ingestion_jobs SET result='{}'::jsonb WHERE job_id=$1",[fresh.job_id]),/protocol|fenced/i);
 await fenced.complete({jobId:fresh.job_id,workerId:'same-worker',claimToken:fresh.claim_token,result:{fresh:true}});
});
live('service fenced wiring rejects old completion after same-worker reacquisition',async({pool})=>{
 await applyMathMigrations(pool);await enable(pool);await createIngestionJobStore(pool).enqueue({kind:'verify-candidate',sourceHash:'synthetic',locator:'p1'});
 let entered,releaseOld,completed;const began=new Promise(r=>entered=r),hold=new Promise(r=>releaseOld=r),finished=new Promise(r=>completed=r);const errors=[];let old,fresh;
 try{
  old=await startIngestionService({env,loadPg:pgFor(pool),onError:e=>errors.push(e),handlers:{'verify-candidate':async()=>{entered();await hold;return {old:true};}}});
  await began;const row=(await pool.query('SELECT * FROM mu_ingestion_jobs')).rows[0];
  const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('math_universe.claim_token',$1,true)",[row.claim_token]);await c.query("UPDATE mu_ingestion_jobs SET lease_until=now()-interval '1 second' WHERE job_id=$1",[row.job_id]);await c.query('COMMIT');}finally{c.release();}
  fresh=await startIngestionService({env,loadPg:pgFor(pool),onError:e=>errors.push(e),handlers:{'verify-candidate':async()=>{completed();return {fresh:true};}}});
  await finished;await fresh.stop();releaseOld();await old.stop();
  const saved=(await pool.query('SELECT * FROM mu_ingestion_jobs')).rows[0];assert.equal(saved.state,'completed');assert.deepEqual(saved.result,{fresh:true});assert.ok(errors.some(e=>e.code==='JOB_LEASE_LOST'));
 }finally{releaseOld?.();await fresh?.stop();await old?.stop();}
});

live('protocol activation serializes against writers and rejects stale isolation snapshots',async({pool})=>{
 await applyMathMigrations(pool);const legacy=createIngestionJobStore(pool);await legacy.enqueue({kind:'verify-candidate',sourceHash:'synthetic',locator:'p1'});
 const old=await pool.connect();try{
  await old.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await old.query('SELECT * FROM mu_ingestion_protocol');
  await enable(pool);
  await assert.rejects(old.query("UPDATE mu_ingestion_jobs SET state='running',worker_id='legacy',lease_until=now()+interval '1 minute'"),/serializ|protocol|fenced/i);
 }finally{await old.query('ROLLBACK');old.release();}
 await assert.rejects(pool.query('TRUNCATE mu_ingestion_jobs'),/protocol|fenced/i);
 const row=(await pool.query('SELECT * FROM mu_ingestion_jobs')).rows[0];assert.equal(row.state,'queued');
});
live('fenced capability does not leak beyond transaction or allow stale legacy checkpoint changes',async({pool})=>{
 await applyMathMigrations(pool);await enable(pool);const legacy=createIngestionJobStore(pool);await legacy.enqueue({kind:'verify-candidate',sourceHash:'synthetic',locator:'p1'});
 const store=createFencedIngestionJobStore(pool);const lease=await store.claim({workerId:'same-worker'});
 await store.renew({jobId:lease.job_id,workerId:'same-worker',claimToken:lease.claim_token});
 const c=await pool.connect();try{assert.ok([null,''].includes((await c.query("SELECT current_setting('math_universe.claim_token',true) AS token")).rows[0].token));}finally{c.release();}
 await assert.rejects(pool.query("UPDATE mu_ingestion_jobs SET checkpoint='{}'::jsonb WHERE job_id=$1",[lease.job_id]),/fenced|protocol/i);
 await store.checkpoint({jobId:lease.job_id,workerId:'same-worker',claimToken:lease.claim_token,checkpoint:{safe:true}});
 await store.fail({jobId:lease.job_id,workerId:'same-worker',claimToken:lease.claim_token,error:'synthetic failure'});
});
live('fenced protocol preserves producer deduplication for running and completed jobs',async({pool})=>{
 await applyMathMigrations(pool);await enable(pool);const producer=createIngestionJobStore(pool),store=createFencedIngestionJobStore(pool);
 const spec={kind:'verify-candidate',sourceHash:'synthetic',locator:'dedup'};const job=await producer.enqueue(spec);const lease=await store.claim({workerId:'same-worker'});
 assert.equal(String((await producer.enqueue(spec)).job_id),String(job.job_id));
 await store.complete({jobId:lease.job_id,workerId:'same-worker',claimToken:lease.claim_token});
 const duplicate=await producer.enqueue(spec);assert.equal(String(duplicate.job_id),String(job.job_id));assert.equal(duplicate.state,'completed');
});

live('restricted runtime service uses public status and guarded jobs without protocol table privileges',async({pool,schema})=>{
 await applyMathMigrations(pool);await enable(pool);
 const {randomUUID}=await import('node:crypto');const role='mu_runtime_'+randomUUID().replaceAll('-','');const {default:pg}=await import('pg');let service;
 await pool.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
 try{
  await pool.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${role}"`);
  await pool.query(`GRANT SELECT,INSERT,UPDATE ON mu_ingestion_jobs TO "${role}"`);
  await pool.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO "${role}"`);
  await createIngestionJobStore(pool).enqueue({kind:'verify-candidate',sourceHash:'synthetic',locator:'restricted'});
  let done;const completed=new Promise(r=>done=r),errors=[];
  const loadPg=async()=>({default:{Pool:class extends pg.Pool {constructor(){super({connectionString:url,options:`-c search_path=${schema} -c role=${role}`,max:2});}}}});
  service=await startIngestionService({env,loadPg,onError:e=>errors.push(e),handlers:{'verify-candidate':async()=>{done();return {restricted:true};}}});
  await completed;await service.stop();
  assert.deepEqual(errors,[]);assert.deepEqual((await pool.query('SELECT result FROM mu_ingestion_jobs')).rows[0].result,{restricted:true});
  const c=await pool.connect();try{await c.query(`SET ROLE "${role}"`);await assert.rejects(c.query("UPDATE mu_ingestion_protocol SET mode='legacy'"),/permission/);await assert.rejects(c.query('SELECT mu_enable_fenced_ingestion()'),/permission/);}finally{await c.query('RESET ROLE');c.release();}
 }finally{await service?.stop();await pool.query(`DROP OWNED BY "${role}"`);await pool.query(`DROP ROLE "${role}"`);}
});
live('protocol activation rejects stale transaction isolation and API overrides pool defaults',async({pool})=>{
 await applyMathMigrations(pool);const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await assert.rejects(c.query('SELECT mu_enable_fenced_ingestion()'),/READ COMMITTED|isolation/i);}finally{await c.query('ROLLBACK');c.release();}
 const stale={async connect(){const client=await pool.connect();await client.query("SET default_transaction_isolation='repeatable read'");return client;}};
 await enable(stale);assert.equal((await pool.query('SELECT mu_ingestion_protocol_status() AS mode')).rows[0].mode,'fenced');
});
live('fenced service protocol accepts uppercase UUIDs supported by the public lease API',async({pool})=>{
 await applyMathMigrations(pool);await enable(pool);await createIngestionJobStore(pool).enqueue({kind:'verify-candidate',sourceHash:'synthetic',locator:'upper'});
 const store=createFencedIngestionJobStore(pool);const lease=await store.claim({workerId:'same-worker'});const args={jobId:lease.job_id,workerId:'same-worker',claimToken:lease.claim_token.toUpperCase()};
 await store.renew(args);await store.complete({...args,result:{upper:true}});assert.deepEqual((await pool.query('SELECT result FROM mu_ingestion_jobs')).rows[0].result,{upper:true});
});
