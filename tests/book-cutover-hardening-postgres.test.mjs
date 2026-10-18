import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
import {fenceBookPostgres} from '../src/book-ingestion/cutover-postgres.mjs';
import {openPostgresBookQueue} from '../src/book-ingestion/postgres-queue.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('first fence rejects a supported writer carrying a pre-fence repeatable-read snapshot',{skip:!url,timeout:10000},async()=>withIsolatedPostgres(url,async({pool})=>{
 await applyBookMigrations(pool);const entered=deferred(),resume=deferred();let pause=false;
 const oldPool={async connect(){const c=await pool.connect();return {release:e=>c.release(e),async query(sql,args){
  if(sql==='BEGIN'){await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');return c.query('SELECT count(*) FROM mu_book_queue');}
  if(pause&&typeof sql==='string'&&sql.startsWith('INSERT INTO mu_book_queue')){pause=false;entered.resolve();await resume.promise;}return c.query(sql,args);
 }}}};
 const queue=await openPostgresBookQueue({pool:oldPool,now:()=>1000});pause=true;
 const write=queue.enqueue({sourceHash:'a'.repeat(64),edition:'synthetic',page:1,extractionVersion:'v1',payload:{}});write.catch(()=>{});
 try{await entered.promise;await fenceBookPostgres({pool,runId:randomUUID(),sourceId:'b'.repeat(64),generation:1});}finally{resume.resolve();}
 await assert.rejects(write,/fenced|serializ/);assert.equal((await pool.query('SELECT count(*) AS n FROM mu_book_jobs')).rows[0].n,'0');
}));
test('ordinary SQL with a pre-fence snapshot cannot delete jobs after first fence',{skip:!url},async()=>withIsolatedPostgres(url,async({pool})=>{
 await applyBookMigrations(pool);const queue=await openPostgresBookQueue({pool,now:()=>1000});await queue.enqueue({sourceHash:'a'.repeat(64),edition:'test',page:1,extractionVersion:'v1',payload:{}});
 const old=await pool.connect();try{
  await old.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await old.query('SELECT count(*) FROM mu_book_jobs');
  await fenceBookPostgres({pool,runId:randomUUID(),sourceId:'b'.repeat(64),generation:1});
  await assert.rejects(old.query('DELETE FROM mu_book_jobs'),/fenced|serializ/);
 }finally{await old.query('ROLLBACK');old.release();}
 assert.equal((await pool.query('SELECT count(*) AS n FROM mu_book_jobs')).rows[0].n,'1');
}));

test('temporary tables cannot shadow the real SQL fence guard',{skip:!url},async()=>withIsolatedPostgres(url,async({pool,schema})=>{
 await applyBookMigrations(pool);const queue=await openPostgresBookQueue({pool,now:()=>1000});await queue.enqueue({sourceHash:'c'.repeat(64),edition:'test',page:1,extractionVersion:'v1',payload:{}});
 await fenceBookPostgres({pool,runId:randomUUID(),sourceId:'b'.repeat(64),generation:1});
 const attacker=await pool.connect();try{
  await attacker.query('CREATE TEMP TABLE mu_book_cutover_guard (singleton boolean,capability_hash text,generation bigint)');
  await attacker.query('CREATE TEMP TABLE mu_book_cutover_epoch (singleton boolean,generation bigint)');await attacker.query('INSERT INTO pg_temp.mu_book_cutover_epoch VALUES(true,0)');
  await assert.rejects(attacker.query(`DELETE FROM "${schema}".mu_book_jobs`),/fenced/);
 }finally{await attacker.query('DROP TABLE IF EXISTS pg_temp.mu_book_cutover_guard,pg_temp.mu_book_cutover_epoch');attacker.release();}
 assert.equal((await pool.query('SELECT count(*) AS n FROM mu_book_jobs')).rows[0].n,'1');
}));
test('004 upgrades an existing 003 fence without changing its owner or generation',{skip:!url},async()=>withIsolatedPostgres(url,async({pool})=>{
 const {readFile}=await import('node:fs/promises');const {migrationBody}=await import('../src/postgres-migrations.mjs');
 await pool.query('CREATE TABLE mu_book_schema_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
 for(const file of ['001_book_queue.sql','002_lossless_json.sql','003_cutover_guard.sql']){await pool.query(migrationBody(await readFile(new URL('../sql/book/'+file,import.meta.url),'utf8'),file));await pool.query('INSERT INTO mu_book_schema_migrations(filename) VALUES($1)',[file]);}
 await openPostgresBookQueue({pool});const runId=randomUUID(),sourceId='d'.repeat(64);
 await pool.query("INSERT INTO mu_book_cutover_guard VALUES(true,$1,$2,7,$3,'STAGING')",[runId,sourceId,'e'.repeat(64)]);
 assert.deepEqual(await applyBookMigrations(pool),['004_cutover_snapshot_fence.sql']);assert.deepEqual(await applyBookMigrations(pool),[]);
 assert.equal((await pool.query('SELECT generation::text FROM mu_book_cutover_epoch')).rows[0].generation,'7');
 const guard=await fenceBookPostgres({pool,runId,sourceId,generation:8});assert.equal(guard.witness.generation,8);await guard.pool.query('DELETE FROM mu_book_jobs');
}));
test('failed fence transaction rolls back guard and epoch; uncertain commit remains fenced',{skip:!url},async()=>withIsolatedPostgres(url,async({pool})=>{
 await applyBookMigrations(pool);await openPostgresBookQueue({pool});const identity={runId:randomUUID(),sourceId:'b'.repeat(64),generation:1};
 const failure=Error('synthetic database fault');
 const faultPool=(where,after=false)=>({async connect(){const c=await pool.connect();return {release:e=>c.release(e),async query(sql,args){if(sql.startsWith(where)){if(after)await c.query(sql,args);throw failure;}return c.query(sql,args);}};}});
 await assert.rejects(fenceBookPostgres({...identity,pool:faultPool('UPDATE mu_book_cutover_epoch')}),e=>e===failure);
 assert.equal((await pool.query('SELECT count(*) AS n FROM mu_book_cutover_guard')).rows[0].n,'0');assert.equal((await pool.query('SELECT generation::text FROM mu_book_cutover_epoch')).rows[0].generation,'0');
 await assert.rejects(fenceBookPostgres({...identity,pool:{async connect(){throw failure;}}}),e=>e===failure);
 await assert.rejects(fenceBookPostgres({...identity,pool:faultPool('COMMIT',true)}),e=>e===failure);
 await assert.rejects(pool.query('DELETE FROM mu_book_jobs'),/fenced/);
 await assert.rejects(fenceBookPostgres({...identity,pool}),/generation/);const fresh=await fenceBookPostgres({...identity,pool,generation:2});await fresh.pool.query('DELETE FROM mu_book_jobs');
}));
