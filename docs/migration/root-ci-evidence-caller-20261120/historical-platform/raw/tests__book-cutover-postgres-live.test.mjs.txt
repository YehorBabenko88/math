import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
test('Book cutover fence API is explicit',async()=>{
 const api=await import('../src/book-ingestion/cutover-postgres.mjs').catch(()=>({}));
 assert.equal(typeof api.fenceBookPostgres,'function');
 assert.equal(typeof api.assertBookPostgresFence,'function');
});
test('Book staging fence blocks ordinary writers and rotates capabilities',{skip:!url},async()=>{
 const {fenceBookPostgres,assertBookPostgresFence}=await import('../src/book-ingestion/cutover-postgres.mjs');
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);
  const identity={runId:randomUUID(),sourceId:'a'.repeat(64),generation:1};
  const first=await fenceBookPostgres({pool,...identity});
  assert.deepEqual(Object.keys(first).sort(),['pool','witness']);
  assert.deepEqual(await assertBookPostgresFence({pool,...identity}),first.witness);
  await assert.rejects(pool.query('INSERT INTO mu_book_queue(max_attempts) VALUES(3) ON CONFLICT DO NOTHING'),/fenced/);
  for(const table of ['mu_book_jobs','mu_book_reviews','mu_book_imports','mu_book_queue'])await assert.rejects(pool.query('TRUNCATE '+table+' CASCADE'),/fenced/);
  await first.pool.query('DELETE FROM mu_book_imports');
  await assert.rejects(fenceBookPostgres({pool,...identity}),/generation/);
  await assert.rejects(fenceBookPostgres({pool,...identity,runId:randomUUID(),generation:2}),/owner/);
  const second=await fenceBookPostgres({pool,...identity,generation:2});
  await assert.rejects(first.pool.query('DELETE FROM mu_book_imports'),/fenced/);
  await second.pool.query('DELETE FROM mu_book_imports');
  await second.pool.query('DELETE FROM mu_book_queue');
  await assert.rejects(assertBookPostgresFence({pool,...identity,generation:2}),/metadata/);
  await assert.rejects(assertBookPostgresFence({pool,...identity}),/mismatch/);
 });
});

test('Book fence serializes native writers, rotation and competing controllers',{skip:!url},async()=>{
 const {fenceBookPostgres}=await import('../src/book-ingestion/cutover-postgres.mjs');
 const {openPostgresBookQueue}=await import('../src/book-ingestion/postgres-queue.mjs');
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);
  const legacy=await openPostgresBookQueue({pool});
  const writer=await pool.connect();
  await writer.query('BEGIN');
  await writer.query('SELECT singleton FROM mu_book_queue WHERE singleton FOR UPDATE');
  const identity={runId:randomUUID(),sourceId:'b'.repeat(64),generation:1};
  let finished=false;
  const pending=fenceBookPostgres({pool,...identity}).then(result=>{finished=true;return result;});
  // A database lock probe verifies the fence has reached the metadata lock.
  for(let n=0;n<100;n++){
   const locks=(await pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT version,max_attempts FROM mu_book_queue%'")).rows;
   if(locks.length)break;
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.equal(finished,false);
  await writer.query('ROLLBACK');writer.release();
  const first=await pending;
  await assert.rejects(legacy.enqueue({sourceHash:'c'.repeat(64),edition:'e',page:1,extractionVersion:'v',payload:{}}),/fenced/);
  const active=await first.pool.connect();await active.query('BEGIN');await active.query('DELETE FROM mu_book_imports');
  let rotated=false;const rotation=fenceBookPostgres({pool,...identity,generation:2}).then(result=>{rotated=true;return result;});
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(rotated,false);
  await active.query('ROLLBACK');active.release();await rotation;
  const results=await Promise.allSettled([fenceBookPostgres({pool,...identity,generation:3}),fenceBookPostgres({pool,...identity,generation:3})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
 });
});


test('Book fence rejects leased targets atomically and preserves unfenced legacy behavior',{skip:!url},async()=>{
 const {fenceBookPostgres}=await import('../src/book-ingestion/cutover-postgres.mjs');
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);
  const job={id:'d'.repeat(64),sourceHash:'e'.repeat(64),edition:'e',page:1,extractionVersion:'v',payload:{},state:'leased',attempts:1,createdAt:1,updatedAt:1,token:'f'.repeat(64),workerId:'old',leaseUntil:100};
  await pool.query('INSERT INTO mu_book_jobs(sqlite_id,ordinal,document) VALUES($1,0,$2)',[job.id,job]);
  await assert.rejects(fenceBookPostgres({pool,runId:randomUUID(),sourceId:'a'.repeat(64),generation:1}),/leased/);
  assert.equal((await pool.query('SELECT * FROM mu_book_cutover_guard')).rows.length,0);
  assert.equal((await pool.query('SELECT * FROM mu_book_queue')).rows.length,0);
  await pool.query('DELETE FROM mu_book_jobs');
  await pool.query('INSERT INTO mu_book_queue(max_attempts) VALUES(3)');
  assert.equal((await pool.query('SELECT max_attempts FROM mu_book_queue')).rows[0].max_attempts,3);
 });
});
