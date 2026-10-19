import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const live=(name,fn)=>test(name,{skip:!url},()=>withIsolatedPostgres(url,fn));
const source=name=>readFile(new URL('../sql/'+name,import.meta.url));
live('generic applied raw SQL drift is detected on every replay',async({pool})=>{
 await applyMathMigrations(pool);await assert.rejects(applyMathMigrations(pool,{readSql:async name=>Buffer.concat([await source(name),Buffer.from('\n-- drift')])}),/MATH_MIGRATION_CONTENT_CHANGED/);
});
live('generic nonempty filename-only ledger is never adopted using current bytes',async({pool})=>{
 await pool.query('CREATE TABLE mu_schema_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
 await pool.query("INSERT INTO mu_schema_migrations(filename) VALUES('001_adapter_snapshots.sql')");
 await assert.rejects(applyMathMigrations(pool,{acceptCurrentHashes:true}),/MATH_MIGRATION_HISTORY_UNVERIFIED/);
 assert.equal((await pool.query("SELECT count(*) AS n FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='mu_schema_migrations'")).rows[0].n,'2');
});
live('generic non-prefix, unknown history and changed checksums fail closed',async({pool})=>{
 await applyMathMigrations(pool);await pool.query("DELETE FROM mu_schema_migrations WHERE filename='002_ingestion_jobs.sql'");
 await assert.rejects(applyMathMigrations(pool),/MATH_MIGRATION_LEDGER_INVALID/);
});
live('generic runners serialize even under stale default isolation',async({pool})=>{
 const stale={async connect(){const c=await pool.connect();await c.query("SET default_transaction_isolation='repeatable read'");return c;}};
 const results=await Promise.all([applyMathMigrations(stale),applyMathMigrations(stale)]);
 assert.equal(results.filter(x=>x.length===0).length,1);
 assert.deepEqual(await applyMathMigrations(pool),[]);
 assert.ok((await pool.query('SELECT sha256,hash_contract FROM mu_schema_migrations')).rows.every(r=>/^[a-f0-9]{64}$/.test(r.sha256)&&r.hash_contract==='sha256-raw-utf8/v1'));
});
live('generic COMMIT ambiguity preserves atomic history and replay',async({pool})=>{
 const fault=after=>({async connect(){const c=await pool.connect();return {release:e=>c.release(e),async query(sql,args){if(sql==='COMMIT'){if(after)await c.query(sql,args);throw Error('synthetic commit loss');}return c.query(sql,args);}};}});
 await assert.rejects(applyMathMigrations(fault(false)),/synthetic commit loss/);
 assert.equal((await pool.query("SELECT to_regclass('mu_schema_migrations') AS ledger")).rows[0].ledger,null);
 await assert.rejects(applyMathMigrations(fault(true)),/synthetic commit loss/);
 assert.deepEqual(await applyMathMigrations(pool),[]);
});

live('known four-script checksum history upgrades additively from exact executed bytes',async({pool})=>{
 const {migrationBody}=await import('../src/postgres-migrations.mjs');const {createHash}=await import('node:crypto');
 const names=['001_adapter_snapshots.sql','002_ingestion_jobs.sql','003_ingestion_claim_fencing.sql','004_ingestion_checkpoints.sql'];
 // This fixture executes captured bytes and records their hash in the SAME
 // transaction. It does not retrofit a filename-only historical database.
 const c=await pool.connect();try{await c.query('BEGIN');await c.query("CREATE TABLE mu_schema_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now(),sha256 text NOT NULL,hash_contract text NOT NULL)");
 for(const filename of names){const bytes=await source(filename);await c.query(migrationBody(bytes.toString('utf8'),filename));await c.query("INSERT INTO mu_schema_migrations(filename,sha256,hash_contract) VALUES($1,$2,'sha256-raw-utf8/v1')",[filename,createHash('sha256').update(bytes).digest('hex')]);}
 await c.query('COMMIT');}finally{c.release();}
 assert.deepEqual(await applyMathMigrations(pool),['005_ingestion_service_protocol.sql']);
 assert.equal((await pool.query('SELECT mu_ingestion_protocol_status() AS mode')).rows[0].mode,'legacy');
});
live('generic raw BOM, CRLF and trailing-byte changes cannot reuse an applied checksum',async({pool})=>{
 await applyMathMigrations(pool);
 for(const mutate of [b=>Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),b]),b=>Buffer.from(b.toString('utf8').replace(/\r?\n/g,'\r\n')),b=>Buffer.concat([b,Buffer.from(' ')])]){
  // The repository may already have CRLF; force a differing newline encoding.
  await assert.rejects(applyMathMigrations(pool,{readSql:async name=>{const b=await source(name);let next=mutate(b);if(next.equals(b))next=Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'));return next;}}),/CONTENT_CHANGED/);
 }
});
live('generic ledger rejects views, nullable checksum, temporary shadow and unsafe schema',async({pool})=>{
 await applyMathMigrations(pool);const c=await pool.connect();try{
  await c.query('CREATE TEMP TABLE mu_schema_migrations(filename text)');assert.deepEqual(await applyMathMigrations({connect:async()=>({query:(...a)=>c.query(...a),release(){}})}),[]);
 }finally{await c.query('DROP TABLE pg_temp.mu_schema_migrations');c.release();}
 await pool.query('ALTER TABLE mu_schema_migrations ALTER COLUMN sha256 DROP NOT NULL');await assert.rejects(applyMathMigrations(pool),/LEDGER_INVALID/);
 await pool.query('ALTER TABLE mu_schema_migrations RENAME TO old_ledger');await pool.query('CREATE VIEW mu_schema_migrations AS SELECT * FROM old_ledger');await assert.rejects(applyMathMigrations(pool),/LEDGER_INVALID/);
});
live('generic migration process crash before and after COMMIT preserves replay integrity',async({pool,schema,url})=>{
 const {spawnSync}=await import('node:child_process');const {pathToFileURL}=await import('node:url');const {resolve}=await import('node:path');
 const script=`import pg from 'pg';const {applyMathMigrations}=await import(${JSON.stringify(pathToFileURL(resolve('src/postgres-migrations.mjs')).href)});const input=JSON.parse(process.argv[1]);const pool=new pg.Pool({connectionString:input.url,options:'-c search_path='+input.schema,max:1});await applyMathMigrations({async connect(){const c=await pool.connect();return {release:e=>c.release(e),async query(sql,args){if(sql==='COMMIT'){if(input.phase==='before')process.exit(71);await c.query(sql,args);process.exit(72);}return c.query(sql,args);}};}});process.exit(3);`;
 for(const [phase,status] of [['before',71],['after',72]]){const result=spawnSync(process.execPath,['--input-type=module','-e',script,JSON.stringify({schema,url,phase})],{windowsHide:true,encoding:'utf8',timeout:15000});assert.equal(result.status,status);
 if(phase==='before')assert.equal((await pool.query("SELECT to_regclass('mu_schema_migrations') AS ledger")).rows[0].ledger,null);
 else{assert.deepEqual(await applyMathMigrations(pool),[]);assert.equal((await pool.query('SELECT count(*) AS n FROM mu_schema_migrations')).rows[0].n,'5');}}
});
