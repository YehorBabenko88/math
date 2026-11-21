import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
import {openPostgresBookQueue} from '../src/book-ingestion/postgres-queue.mjs';
import {fenceBookPostgres} from '../src/book-ingestion/cutover-postgres.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const source=name=>readFile(new URL('../sql/book/'+name,import.meta.url));
const live=(name,fn)=>test(name,{skip:!url},()=>withIsolatedPostgres(url,fn));
live('applied migration content is read and SHA-256 drift rejects before mutation',async({pool})=>{
 await applyBookMigrations(pool);await assert.rejects(applyBookMigrations(pool,{readSql:async name=>Buffer.concat([await source(name),Buffer.from('\n-- tampered')]).toString('utf8')}),/BOOK_MIGRATION_CONTENT_CHANGED/);
});
live('filename-only historical ledger is never automatically trusted',async({pool})=>{
 await pool.query('CREATE TABLE mu_book_schema_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
 await pool.query("INSERT INTO mu_book_schema_migrations(filename) VALUES('001_book_queue.sql'),('002_lossless_json.sql'),('003_cutover_guard.sql'),('004_cutover_snapshot_fence.sql')");
 await assert.rejects(applyBookMigrations(pool),/BOOK_MIGRATION_HISTORY_UNVERIFIED/);
 assert.equal((await pool.query("SELECT count(*) AS n FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='mu_book_schema_migrations'")).rows[0].n,'2');
});
live('non-prefix ledger history is rejected instead of skipped',async({pool})=>{
 await applyBookMigrations(pool);await pool.query("DELETE FROM mu_book_schema_migrations WHERE filename='002_lossless_json.sql'");
 await assert.rejects(applyBookMigrations(pool),/BOOK_MIGRATION_LEDGER_INVALID/);
});
live('control generation updates cannot be committed without the matching epoch',async({pool})=>{
 await applyBookMigrations(pool);await openPostgresBookQueue({pool});const identity={pool,runId:randomUUID(),sourceId:'a'.repeat(64),generation:1};await fenceBookPostgres(identity);
 await assert.rejects(pool.query('UPDATE mu_book_cutover_guard SET generation=2'),/generation|epoch|control/i);
 assert.equal((await pool.query('SELECT generation::text FROM mu_book_cutover_guard')).rows[0].generation,'1');
});
live('least-privilege native writer works without UPDATE permission on control tables',async({pool,schema})=>{
 await applyBookMigrations(pool);const role='mu_role_'+randomUUID().replaceAll('-','');await pool.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
 try{await pool.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${role}"`);await pool.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON mu_book_queue,mu_book_jobs,mu_book_reviews,mu_book_imports TO "${role}"`);await pool.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO "${role}"`);
 const resets=[];const restricted={async connect(){const c=await pool.connect();await c.query(`SET ROLE "${role}"`);return {query:(...args)=>c.query(...args),release(error){resets.push(c.query('RESET ROLE').then(()=>c.release(error),e=>c.release(e)));}};}};
 const q=await openPostgresBookQueue({pool:restricted,now:()=>1000});await q.enqueue({sourceHash:'b'.repeat(64),edition:'test',page:1,extractionVersion:'v1',payload:{}});
 const lease=await q.acquire({workerId:'least-privilege',leaseMs:1000});await q.checkpoint(lease.id,lease.token,{metrics:{pagesAttempted:1}});assert.equal((await q.complete(lease.id,lease.token,{result:{stage:'review_required'},metrics:{}})).state,'completed');await Promise.all(resets);
 const guard=await fenceBookPostgres({pool,runId:randomUUID(),sourceId:'c'.repeat(64),generation:1});assert.equal(guard.witness.generation,1);await assert.rejects(q.enqueue({sourceHash:'d'.repeat(64),edition:'test',page:2,extractionVersion:'v1',payload:{}}),/fenced/);await Promise.all(resets);
 const probe=await pool.connect();try{await probe.query(`SET ROLE "${role}"`);for(const sql of ['SELECT * FROM mu_book_cutover_guard','UPDATE mu_book_cutover_epoch SET generation=generation+1','DELETE FROM mu_book_cutover_guard','ALTER TABLE mu_book_jobs DISABLE TRIGGER ALL',"SELECT mu_book_check_cutover_guard()",'CREATE TABLE unauthorized(id int)'])await assert.rejects(probe.query(sql),/permission|owner/);}finally{await probe.query('RESET ROLE');probe.release();}
 }finally{await pool.query(`DROP OWNED BY "${role}"`);await pool.query(`DROP ROLE "${role}"`);}
});
live('legacy inspection is read-only and empty filename ledgers may bootstrap safely',async({pool})=>{
 const {inspectBookMigrationLedger,BOOK_MIGRATIONS}=await import('../src/book-ingestion/postgres-migrations.mjs');
 await pool.query('CREATE TABLE mu_book_schema_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
 const empty=await inspectBookMigrationLedger(pool);assert.equal(empty.state,'legacy-unverified');assert.equal(empty.requiresHistoricalProof,false);
 assert.deepEqual(await applyBookMigrations(pool),BOOK_MIGRATIONS);const full=await inspectBookMigrationLedger(pool);assert.equal(full.state,'checksummed');assert.equal(full.historicalExecutionAttested,false);assert.equal(full.automaticAdoption,false);
});
live('legacy plan never offers current hashes as proof of past execution',async({pool})=>{
 const {inspectBookMigrationLedger}=await import('../src/book-ingestion/postgres-migrations.mjs');
 await pool.query('CREATE TABLE mu_book_schema_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');await pool.query("INSERT INTO mu_book_schema_migrations(filename) VALUES('001_book_queue.sql')");
 const before=(await pool.query('SELECT * FROM mu_book_schema_migrations')).rows;const plan=await inspectBookMigrationLedger(pool);assert.equal(plan.requiresHistoricalProof,true);assert.equal(plan.automaticAdoption,false);assert.equal(plan.historicalExecutionAttested,false);assert.equal(plan.applied[0].sha256,undefined);
 await assert.rejects(applyBookMigrations(pool,{acceptCurrentHashes:true,operatorConfirmed:true}),/BOOK_MIGRATION_HISTORY_UNVERIFIED/);assert.deepEqual((await pool.query('SELECT * FROM mu_book_schema_migrations')).rows,before);
});
live('invalid hashes, unknown history, views and nullable ledger columns fail closed',async({pool})=>{
 await applyBookMigrations(pool);const original=(await pool.query('SELECT sha256 FROM mu_book_schema_migrations ORDER BY filename LIMIT 1')).rows[0].sha256;
 await pool.query("UPDATE mu_book_schema_migrations SET sha256=$1 WHERE filename='001_book_queue.sql'",['0'.repeat(64)]);await assert.rejects(applyBookMigrations(pool),/CONTENT_CHANGED/);
 await pool.query("UPDATE mu_book_schema_migrations SET sha256=$1 WHERE filename='001_book_queue.sql'",[original]);await pool.query("INSERT INTO mu_book_schema_migrations(filename,sha256,hash_contract) VALUES('999_unknown.sql',$1,'sha256-raw-utf8/v1')",['a'.repeat(64)]);await assert.rejects(applyBookMigrations(pool),/LEDGER_INVALID/);await pool.query("DELETE FROM mu_book_schema_migrations WHERE filename='999_unknown.sql'");
 await pool.query('ALTER TABLE mu_book_schema_migrations ALTER COLUMN sha256 DROP NOT NULL');await assert.rejects(applyBookMigrations(pool),/LEDGER_INVALID/);
 await pool.query('ALTER TABLE mu_book_schema_migrations RENAME TO old_ledger');await pool.query('CREATE VIEW mu_book_schema_migrations AS SELECT * FROM old_ledger');await assert.rejects(applyBookMigrations(pool),/LEDGER_INVALID/);
});
live('concurrent runners override stale default isolation and serialize checksums',async({pool})=>{
 const {BOOK_MIGRATIONS}=await import('../src/book-ingestion/postgres-migrations.mjs');
 const oldDefault={async connect(){const c=await pool.connect();await c.query("SET default_transaction_isolation='repeatable read'");return c;}};
 const result=await Promise.all([applyBookMigrations(oldDefault),applyBookMigrations(oldDefault)]);assert.deepEqual(result.map(x=>x.length).sort(),[0,5]);assert.equal((await pool.query('SELECT count(*) AS n FROM mu_book_schema_migrations')).rows[0].n,String(BOOK_MIGRATIONS.length));
});
live('pre-COMMIT failure rolls back; post-COMMIT acknowledgement loss replays without DDL',async({pool})=>{
 const error=Error('synthetic commit connection loss');
 const fault=after=>({async connect(){const c=await pool.connect();return {release:e=>c.release(e),async query(sql,args){if(sql==='COMMIT'){if(after)await c.query(sql,args);throw error;}return c.query(sql,args);}};}});
 await assert.rejects(applyBookMigrations(fault(false)),e=>e===error);assert.equal((await pool.query("SELECT to_regclass('mu_book_jobs') AS jobs")).rows[0].jobs,null);
 await assert.rejects(applyBookMigrations(fault(true)),e=>e===error);assert.deepEqual(await applyBookMigrations(pool),[]);assert.equal((await pool.query('SELECT count(*) AS n FROM mu_book_schema_migrations')).rows[0].n,'5');
});
live('incompatible legacy controllers and generation downgrades cannot commit',async({pool})=>{
 await applyBookMigrations(pool);await openPostgresBookQueue({pool});const identity={pool,runId:randomUUID(),sourceId:'a'.repeat(64),generation:1};await fenceBookPostgres(identity);
 for(const sql of ['UPDATE mu_book_cutover_guard SET generation=2',"UPDATE mu_book_cutover_guard SET generation=2,capability_hash=repeat('a',64)",'UPDATE mu_book_cutover_epoch SET generation=2','UPDATE mu_book_cutover_epoch SET generation=0','DELETE FROM mu_book_cutover_guard','TRUNCATE mu_book_cutover_epoch'])await assert.rejects(pool.query(sql),/control|epoch|generation/i);
 assert.equal((await fenceBookPostgres({...identity,generation:2})).witness.generation,2);
});

live('old controller cannot create a guard without its epoch in the same commit',async({pool})=>{
 await applyBookMigrations(pool);await openPostgresBookQueue({pool});const c=await pool.connect();try{await c.query('BEGIN');await c.query("INSERT INTO mu_book_cutover_guard VALUES(true,$1,$2,1,$3,'STAGING')",[randomUUID(),'a'.repeat(64),'b'.repeat(64)]);await assert.rejects(c.query('COMMIT'),/epoch\/generation/);}finally{await c.query('ROLLBACK');c.release();}
 assert.equal((await pool.query('SELECT count(*) AS n FROM mu_book_cutover_guard')).rows[0].n,'0');
});
live('stale repeatable-read control snapshots cannot overwrite a newer generation',async({pool})=>{
 await applyBookMigrations(pool);await openPostgresBookQueue({pool});const identity={pool,runId:randomUUID(),sourceId:'a'.repeat(64),generation:1};await fenceBookPostgres(identity);const old=await pool.connect();try{await old.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await old.query('SELECT generation FROM mu_book_cutover_guard');await fenceBookPostgres({...identity,generation:2});await assert.rejects(old.query('UPDATE mu_book_cutover_guard SET generation=3'),/serializ/);}finally{await old.query('ROLLBACK');old.release();}
 assert.equal((await pool.query('SELECT generation::text FROM mu_book_cutover_guard')).rows[0].generation,'2');
});
live('temporary ledger cannot shadow trusted schema history',async({pool})=>{
 await applyBookMigrations(pool);const c=await pool.connect();try{await c.query('CREATE TEMP TABLE mu_book_schema_migrations(filename text)');await c.query("INSERT INTO pg_temp.mu_book_schema_migrations VALUES('999_fake.sql')");
 assert.deepEqual(await applyBookMigrations({connect:async()=>({query:(...args)=>c.query(...args),release(){}})}),[]);
 }finally{await c.query('DROP TABLE pg_temp.mu_book_schema_migrations');c.release();}
});
live('a broken rollback preserves the migration error and discards its connection',async({pool})=>{
 const original=Error('synthetic migration failure'),rollback=Error('synthetic rollback failure');let discarded;
 const fault={async connect(){const c=await pool.connect();return {async query(sql,args){if(sql.includes('CREATE TABLE mu_book_queue'))throw original;if(sql==='ROLLBACK')throw rollback;return c.query(sql,args);},release(error){discarded=error;c.release(error);}};}};
 await assert.rejects(applyBookMigrations(fault),e=>e===original);assert.equal(discarded,rollback);assert.equal((await pool.query("SELECT to_regclass('mu_book_schema_migrations') AS ledger")).rows[0].ledger,null);
});
live('migration process crash before/after COMMIT preserves atomic checksum history',async({pool,schema,url})=>{
 const {spawnSync}=await import('node:child_process');const {pathToFileURL}=await import('node:url');const {resolve}=await import('node:path');
 const script=`import pg from 'pg';const {applyBookMigrations}=await import(${JSON.stringify(pathToFileURL(resolve('src/book-ingestion/postgres-migrations.mjs')).href)});const input=JSON.parse(process.argv[1]);const pool=new pg.Pool({connectionString:input.url,options:'-c search_path='+input.schema,max:1});await applyBookMigrations({async connect(){const c=await pool.connect();return {release:e=>c.release(e),async query(sql,args){if(sql==='COMMIT'){if(input.phase==='before')process.exit(71);await c.query(sql,args);process.exit(72);}return c.query(sql,args);}};}});process.exit(3);`;
 for(const [phase,status] of [['before',71],['after',72]]){
  const result=spawnSync(process.execPath,['--input-type=module','-e',script,JSON.stringify({schema,url,phase})],{windowsHide:true,encoding:'utf8',timeout:15000});assert.equal(result.status,status);
  if(phase==='before')assert.equal((await pool.query("SELECT to_regclass('mu_book_schema_migrations') AS ledger")).rows[0].ledger,null);
  else{assert.deepEqual(await applyBookMigrations(pool),[]);assert.equal((await pool.query('SELECT count(*) AS n FROM mu_book_schema_migrations')).rows[0].n,'5');}
 }
});
live('untrusted schema CREATE cannot inject an owner-executed migration helper',async({pool,schema})=>{
 await applyBookMigrations(pool);await pool.query('CREATE TABLE migration_attack_marker(id int)');const role='mu_role_'+randomUUID().replaceAll('-','');await pool.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`);
 const c=await pool.connect();try{
  await c.query(`GRANT USAGE,CREATE ON SCHEMA "${schema}" TO PUBLIC`);await c.query(`SET ROLE "${role}"`);
  await c.query(`CREATE FUNCTION "${schema}".cardinality(smallint[]) RETURNS integer LANGUAGE plpgsql AS $$ BEGIN INSERT INTO "${schema}".migration_attack_marker VALUES(1); RETURN 1; END; $$`);await c.query('RESET ROLE');
  let failure;try{await applyBookMigrations(pool);}catch(error){failure=error;}
  assert.equal((await pool.query('SELECT count(*) AS n FROM migration_attack_marker')).rows[0].n,'0');assert.match(failure?.message??'',/BOOK_MIGRATION_SCHEMA_UNTRUSTED/);
 }finally{await c.query('RESET ROLE');c.release();await pool.query(`DROP OWNED BY "${role}"`);await pool.query(`DROP ROLE "${role}"`);}
});
live('early advisory lookup cannot execute attacker code before ACL rejection',async({pool,schema})=>{
 await applyBookMigrations(pool);await pool.query('CREATE SEQUENCE migration_preflight_marker');const role='mu_role_'+randomUUID().replaceAll('-','');await pool.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`);const c=await pool.connect();
 try{await c.query(`GRANT USAGE,CREATE ON SCHEMA "${schema}" TO PUBLIC`);await c.query(`SET ROLE "${role}"`);await c.query(`CREATE FUNCTION "${schema}".pg_advisory_xact_lock(integer,integer) RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_catalog.nextval('"${schema}".migration_preflight_marker'); END; $$`);await c.query('RESET ROLE');await c.query("SELECT pg_catalog.set_config('search_path',$1,false)",['"'+schema+'",pg_catalog']);
 await assert.rejects(applyBookMigrations({connect:async()=>({query:(...args)=>c.query(...args),release(){}})}),/SCHEMA_UNTRUSTED/);
 assert.equal((await pool.query('SELECT is_called FROM migration_preflight_marker')).rows[0].is_called,false);
 }finally{await c.query('RESET ROLE');c.release();await pool.query(`DROP OWNED BY "${role}"`);await pool.query(`DROP ROLE "${role}"`);}
});
