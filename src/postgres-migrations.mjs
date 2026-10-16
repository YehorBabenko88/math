// Explicit, opt-in PostgreSQL migrations. Never invoked by service startup.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const migrations=['001_adapter_snapshots.sql','002_ingestion_jobs.sql','003_ingestion_claim_fencing.sql','004_ingestion_checkpoints.sql'];
// Strip only transaction statements at the boundaries of these trusted scripts,
// including their header/footer comments. Function bodies keep their own BEGIN.
const trivia=String.raw`(?:\s|--[^\r\n]*(?:\r?\n|$)|/\*[\s\S]*?\*/)*`;
const openingTransaction=new RegExp('^'+trivia+String.raw`BEGIN\s*;`,'i');
const closingTransaction=new RegExp(String.raw`\bCOMMIT\s*;`+trivia+'$','i');
export async function applyMathMigrations(pool,{readSql=async name=>readFile(fileURLToPath(new URL('../sql/'+name,import.meta.url)),'utf8')}={}){
 if(!pool||typeof pool.connect!=='function')throw Error('PostgreSQL pool with connect() required');
 const client=await pool.connect();
 let inTransaction=false;
 try{
  await client.query('BEGIN');inTransaction=true;
  await client.query('SELECT pg_advisory_xact_lock(732814,1)');
  await client.query('CREATE TABLE IF NOT EXISTS mu_schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied=await client.query('SELECT filename FROM mu_schema_migrations');
  const done=new Set(applied.rows.map(row=>row.filename));
  const executed=[];
  for(const name of migrations){
   if(done.has(name))continue;
   const sql=await readSql(name);
   if(typeof sql!=='string'||!sql.trim())throw Error('Empty migration: '+name);
   // SQL files contain their own BEGIN/COMMIT: strip those so outer transaction is authoritative.
   const body=sql.replace(openingTransaction,'').replace(closingTransaction,'');
   await client.query(body);
   await client.query('INSERT INTO mu_schema_migrations (filename) VALUES ($1)',[name]);
   executed.push(name);
  }
  await client.query('COMMIT');inTransaction=false;
  return executed;
 }catch(error){
  if(inTransaction)await client.query('ROLLBACK');
  throw error;
 }finally{client.release()}
}
