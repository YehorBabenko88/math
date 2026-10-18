// Explicit opt-in only: queue construction never mutates schema.
import {readFile} from 'node:fs/promises';
import {migrationBody} from '../postgres-migrations.mjs';
export async function applyBookMigrations(pool,{readSql=async name=>readFile(new URL('../../sql/book/'+name,import.meta.url),'utf8')}={}){
 if(!pool||typeof pool.connect!=='function')throw Error('PostgreSQL pool with connect() required');
 const client=await pool.connect();let active=false,releaseError;
 try{
  await client.query('BEGIN');active=true;
  await client.query('SELECT pg_advisory_xact_lock(732814,2)');
  await client.query('CREATE TABLE IF NOT EXISTS mu_book_schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done=new Set((await client.query('SELECT filename FROM mu_book_schema_migrations')).rows.map(r=>r.filename)),executed=[];
  for(const name of ['001_book_queue.sql','002_lossless_json.sql','003_cutover_guard.sql','004_cutover_snapshot_fence.sql']){
   if(done.has(name))continue;
   const sql=await readSql(name);if(typeof sql!=='string'||!sql.trim())throw Error('Empty migration: '+name);
   await client.query(migrationBody(sql,name));
   await client.query('INSERT INTO mu_book_schema_migrations (filename) VALUES ($1)',[name]);executed.push(name);
  }
  await client.query('COMMIT');active=false;return executed;
 }catch(error){if(active)try{await client.query('ROLLBACK')}catch(e){releaseError=e}throw error}
 finally{client.release(releaseError)}
}
