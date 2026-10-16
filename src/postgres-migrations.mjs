// Explicit, opt-in PostgreSQL migrations. Never invoked by service startup.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const migrations=['001_adapter_snapshots.sql','002_ingestion_jobs.sql','003_ingestion_claim_fencing.sql','004_ingestion_checkpoints.sql'];
// Lex statement boundaries without touching comments, strings or dollar-quoted
// function bodies. These are trusted repository scripts, not arbitrary SQL input.
export function migrationBody(sql,name){
 // UTF-8 files may begin with a BOM, which PostgreSQL does not accept as SQL whitespace.
 if(sql.charCodeAt(0)===0xFEFF)sql=sql.slice(1);
 const statements=[];let tokens=[];let start=-1;let i=0;
 const token=(value,at)=>{if(start<0)start=at;tokens.push(value)};
 const finish=end=>{if(tokens.length)statements.push({tokens,start,end});tokens=[];start=-1};
 while(i<sql.length){
  const c=sql[i];
  if(/\s/.test(c)){i++;continue}
  if(sql.startsWith('--',i)){while(i<sql.length&&!/[\r\n]/.test(sql[i]))i++;continue}
  if(sql.startsWith('/*',i)){
   let depth=1;i+=2;
   while(i<sql.length&&depth){if(sql.startsWith('/*',i)){depth++;i+=2}else if(sql.startsWith('*/',i)){depth--;i+=2}else i++}
   if(depth)throw Error('Unterminated migration comment: '+name);
   continue;
  }
  if(c==="'"||c==='"'){
   const quote=c;const at=i++;const escape=quote==="'"&&sql[at-1]?.toUpperCase()==='E'&&(at<2||!/[\w$]/.test(sql[at-2]));
   let closed=false;
   while(i<sql.length){if(escape&&sql[i]==='\\'){i+=2;continue}if(sql[i++]===quote){if(sql[i]===quote){i++;continue}closed=true;break}}
   if(!closed)throw Error('Unterminated migration quote: '+name);
   token('quoted',at);continue;
  }
  const dollar=c==='$'&&sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/);
  if(dollar){const at=i;const end=sql.indexOf(dollar[0],i+dollar[0].length);if(end<0)throw Error('Unterminated migration dollar quote: '+name);i=end+dollar[0].length;token('quoted',at);continue}
  if(c===';'){finish(++i);continue}
  const word=sql.slice(i).match(/^[A-Za-z_][A-Za-z_0-9$]*/);
  if(word){token(word[0].toUpperCase(),i);i+=word[0].length}else{token(c,i);i++}
 }
 finish(i);
 const first=statements[0];const last=statements.at(-1);
 const wrapper=first?.tokens.length===1&&first.tokens[0]==='BEGIN'&&last!==first&&last?.tokens.length===1&&last.tokens[0]==='COMMIT';
 const inner=wrapper?statements.slice(1,-1):statements;
 for(const {tokens} of inner){
  if(['BEGIN','START','COMMIT','END','ROLLBACK','ABORT','SAVEPOINT','RELEASE'].includes(tokens[0])||(tokens[0]==='PREPARE'&&tokens[1]==='TRANSACTION'))throw Error('Migration transaction control is not allowed: '+name);
 }
 if(!wrapper)return sql;
 return sql.slice(0,first.start)+sql.slice(first.end,last.start)+sql.slice(last.end);
}
export async function applyMathMigrations(pool,{readSql=async name=>readFile(fileURLToPath(new URL('../sql/'+name,import.meta.url)),'utf8')}={}){
 if(!pool||typeof pool.connect!=='function')throw Error('PostgreSQL pool with connect() required');
 const client=await pool.connect();
 let inTransaction=false;let releaseError;
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
   const body=migrationBody(sql,name);
   await client.query(body);
   await client.query('INSERT INTO mu_schema_migrations (filename) VALUES ($1)',[name]);
   executed.push(name);
  }
  await client.query('COMMIT');inTransaction=false;
  return executed;
 }catch(error){
  if(inTransaction){
   try{await client.query('ROLLBACK')}catch(rollbackError){releaseError=rollbackError}
  }
  throw error;
 }finally{client.release(releaseError)}
}
