// Explicit opt-in only. Historical filename-only entries are never backfilled
// from today's files: a digest of current bytes is not proof of past execution.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
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

export const MATH_MIGRATION_HASH_CONTRACT='sha256-raw-utf8/v1';
export const MATH_MIGRATIONS=Object.freeze(['001_adapter_snapshots.sql','002_ingestion_jobs.sql','003_ingestion_claim_fencing.sql','004_ingestion_checkpoints.sql','005_ingestion_service_protocol.sql']);
const defaultRead=name=>readFile(new URL('../sql/'+name,import.meta.url));
const reject=code=>{throw Error(code);};
const identifier=value=>'"'+value.replaceAll('"','""')+'"';
async function sources(readSql=defaultRead){
 const result=[];for(const filename of MATH_MIGRATIONS){
  const input=await readSql(filename);if(typeof input!=='string'&&!Buffer.isBuffer(input))reject('MATH_MIGRATION_SOURCE_INVALID');
  const bytes=Buffer.from(input);let sql;try{sql=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{reject('MATH_MIGRATION_SOURCE_INVALID');}
  if(typeof input==='string'&&sql!==input||!sql.trim())reject('MATH_MIGRATION_SOURCE_INVALID');
  const body=migrationBody(sql,filename);if(!body.trim())reject('MATH_MIGRATION_SOURCE_INVALID');
  result.push(Object.freeze({filename,sha256:createHash('sha256').update(bytes).digest('hex'),hashContract:MATH_MIGRATION_HASH_CONTRACT,byteLength:bytes.length,body}));
 }return result;
}
const manifest=entries=>entries.map(({body,...entry})=>Object.freeze(entry));
export async function loadMathMigrationManifest(options={}){return Object.freeze(manifest(await sources(options.readSql)));}
async function scope(client){
 const row=(await client.query('SELECT pg_catalog.current_schema() AS schema')).rows[0];
 if(!row?.schema||['pg_catalog','information_schema'].includes(row.schema)||/^pg_(temp|toast)/.test(row.schema))reject('MATH_MIGRATION_SCHEMA_INVALID');
 await client.query("SELECT pg_catalog.set_config('search_path','pg_catalog,pg_temp',true)");
 // The DDL must create objects in this schema. Do not put an untrusted CREATE
 // namespace before pg_catalog and then run helpers under migration authority.
 const policy=(await client.query("SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a WHERE n.nspname=$1 AND a.privilege_type='CREATE' AND a.grantee<>n.nspowner) AS unsafe",[row.schema])).rows[0];
 if(!policy||policy.unsafe)reject('MATH_MIGRATION_SCHEMA_UNTRUSTED');
 await client.query("SELECT pg_catalog.set_config('search_path',$1,true)",['pg_catalog,'+identifier(row.schema)+',pg_temp']);return row.schema;
}
async function ledger(client,schema,entries){
 const relation=(await client.query("SELECT c.oid::text,c.relkind,c.relrowsecurity,c.relforcerowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname='mu_schema_migrations'",[schema])).rows;
 if(!relation.length)return {kind:'absent',rows:[]};const r=relation[0];
 if(relation.length!==1||r.relkind!=='r'||r.relrowsecurity||r.relforcerowsecurity)reject('MATH_MIGRATION_LEDGER_INVALID');
 const columns=(await client.query('SELECT attname,atttypid::int AS type,attnotnull FROM pg_catalog.pg_attribute WHERE attrelid=$1::oid AND attnum>0 AND NOT attisdropped ORDER BY attnum',[r.oid])).rows;
 const legacy=columns.length===2,types=legacy?{filename:25,applied_at:1184}:{filename:25,applied_at:1184,sha256:25,hash_contract:25};
 if(columns.length!==Object.keys(types).length||columns.some(c=>types[c.attname]!==c.type||!c.attnotnull))reject('MATH_MIGRATION_LEDGER_INVALID');
 const primary=(await client.query("SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=$1::oid AND contype='p' AND pg_catalog.cardinality(conkey)=1 AND conkey[1]=(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=$1::oid AND attname='filename')) AS valid",[r.oid])).rows[0];if(!primary?.valid)reject('MATH_MIGRATION_LEDGER_INVALID');
 const rows=(await client.query(`SELECT filename,applied_at::text${legacy?'':',sha256,hash_contract'} FROM ${identifier(schema)}.mu_schema_migrations ORDER BY filename`)).rows;
 if(rows.length>entries.length||rows.some((row,i)=>row.filename!==entries[i].filename||typeof row.applied_at!=='string'||!Number.isFinite(Date.parse(row.applied_at))))reject('MATH_MIGRATION_LEDGER_INVALID');
 if(!legacy)for(const [i,row] of rows.entries()){
  if(!/^[a-f0-9]{64}$/.test(row.sha256)||row.hash_contract!==MATH_MIGRATION_HASH_CONTRACT)reject('MATH_MIGRATION_LEDGER_INVALID');
  if(row.sha256!==entries[i].sha256)reject('MATH_MIGRATION_CONTENT_CHANGED: '+row.filename);
 }
 return {kind:legacy?'legacy-unverified':'checksummed',rows};
}
async function transaction(pool,readOnly,fn){
 if(!pool||typeof pool.connect!=='function')throw Error('PostgreSQL pool with connect() required');
 const client=await pool.connect();let active=false,releaseError;
 try{
  // A waiting runner must take a fresh snapshot after the advisory lock.
  await client.query('BEGIN ISOLATION LEVEL READ COMMITTED'+(readOnly?' READ ONLY':''));active=true;
  await client.query('SELECT pg_catalog.pg_advisory_xact_lock(732814,1)');
  const result=await fn(client,await scope(client));await client.query('COMMIT');active=false;return result;
 }catch(error){if(active)try{await client.query('ROLLBACK')}catch(e){releaseError=e}throw error;}
 finally{client.release(releaseError);}
}
export async function inspectMathMigrationLedger(pool,options={}){
 const entries=await sources(options.readSql);return transaction(pool,true,async(client,schema)=>{
  const current=await ledger(client,schema,entries);
  return {version:'math-migration-ledger/v1',schema,state:current.kind,applied:current.rows,currentManifest:manifest(entries),pending:entries.slice(current.rows.length).map(x=>x.filename),requiresHistoricalProof:current.kind==='legacy-unverified'&&current.rows.length>0,automaticAdoption:false,historicalExecutionAttested:false};
 });
}
export async function applyMathMigrations(pool,options={}){
 const entries=await sources(options.readSql);return transaction(pool,false,async(client,schema)=>{
  let current=await ledger(client,schema,entries);const table=identifier(schema)+'.mu_schema_migrations';
  if(current.kind==='legacy-unverified'&&current.rows.length)reject('MATH_MIGRATION_HISTORY_UNVERIFIED');
  if(current.kind==='absent')await client.query(`CREATE TABLE ${table} (filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now(),sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),hash_contract text NOT NULL CHECK(hash_contract='${MATH_MIGRATION_HASH_CONTRACT}'))`);
  else if(current.kind==='legacy-unverified')await client.query(`ALTER TABLE ${table} ADD COLUMN sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),ADD COLUMN hash_contract text NOT NULL CHECK(hash_contract='${MATH_MIGRATION_HASH_CONTRACT}')`);
  await client.query(`REVOKE ALL ON TABLE ${table} FROM PUBLIC`);
  const executed=[];for(const entry of entries.slice(current.rows.length)){
   // Historical scripts create unqualified objects and use current_schema().
   // Enable only the validated target for DDL, then return metadata to catalog.
   await client.query("SELECT pg_catalog.set_config('search_path',$1,true)",[identifier(schema)+',pg_catalog,pg_temp']);
   await client.query(entry.body);
   await client.query("SELECT pg_catalog.set_config('search_path',$1,true)",['pg_catalog,'+identifier(schema)+',pg_temp']);
   await client.query(`INSERT INTO ${table} (filename,sha256,hash_contract) VALUES ($1,$2,$3)`,[entry.filename,entry.sha256,entry.hashContract]);executed.push(entry.filename);
  }return executed;
 });
}
