import {createHash,randomBytes} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const columns='run_id::text,source_id,generation::text,capability_hash,mode';
function validate({pool,runId,sourceId,generation}){
 if(!pool||typeof pool.connect!=='function'||typeof runId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(runId)||typeof sourceId!=='string'||!/^[a-f0-9]{64}$/.test(sourceId)||!Number.isSafeInteger(generation)||generation<1)throw Error('Invalid Book fence identity');
}
async function witness(client,row){
 const target=(await client.query('SELECT current_database() AS database,current_schema() AS schema,inet_server_port() AS port')).rows[0];
 const targetId=hash(JSON.stringify(target));
 return {runId:row.run_id,sourceId:row.source_id,generation:Number(row.generation),targetId,guardDigest:hash(JSON.stringify([row.run_id,row.source_id,row.generation,row.capability_hash,row.mode,targetId]))};
}
// The random capability exists only in this closure. SQL receives a bound parameter.
function guardedPool(pool,token){
 return {async connect(){
  const client=await pool.connect();
  return {async query(sql,args){
   const result=await client.query(sql,args);
   const text=typeof sql==='string'?sql:sql?.text;
   if(/^\s*BEGIN\b/i.test(text))await client.query("SELECT set_config('mu.book_cutover_token',$1,true)",[token]);
   return result;
  },release(error){client.release(error)}};
 },async query(sql,args){
  const client=await this.connect();let broken;
  try{await client.query('BEGIN');const result=await client.query(sql,args);await client.query('COMMIT');return result;}
  catch(error){try{await client.query('ROLLBACK')}catch(e){broken=e}throw error;}
  finally{client.release(broken)}
 }};
}
export async function fenceBookPostgres(options){
 validate(options);const {pool,runId,sourceId,generation,maxAttempts=3}=options;
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>10)throw Error('Invalid Book maxAttempts');
 const client=await pool.connect();let broken;
 try{
  await client.query('BEGIN');
  // Existing guards are locked before metadata, matching trigger lock order.
  await client.query('SELECT singleton FROM mu_book_cutover_guard WHERE singleton FOR UPDATE');
  // The metadata lock is the serialization point shared by every native writer.
  // Existing staging guards reject metadata INSERTs, so avoid an unnecessary insert.
  let meta=(await client.query('SELECT version,max_attempts FROM mu_book_queue WHERE singleton FOR UPDATE')).rows;
  if(meta.length===0){await client.query('INSERT INTO mu_book_queue(max_attempts) VALUES($1) ON CONFLICT DO NOTHING',[maxAttempts]);meta=(await client.query('SELECT version,max_attempts FROM mu_book_queue WHERE singleton FOR UPDATE')).rows;}
  if(meta.length!==1||meta[0].version!==1||meta[0].max_attempts!==maxAttempts)throw Error('Invalid queue state');
  const guards=(await client.query(`SELECT ${columns} FROM mu_book_cutover_guard WHERE singleton FOR UPDATE`)).rows;
  if(guards.length){const old=guards[0];if(old.run_id!==runId.toLowerCase()||old.source_id!==sourceId)throw Error('Book fence owner conflict');if(Number(old.generation)>=generation)throw Error('Book fence generation must increase');}
  if((await client.query("SELECT 1 FROM mu_book_jobs WHERE document->>'state'='leased' LIMIT 1")).rows.length)throw Error('Book target has active leased jobs');
  const token=randomBytes(32).toString('hex');
  const row=(await client.query(`INSERT INTO mu_book_cutover_guard(singleton,run_id,source_id,generation,capability_hash,mode) VALUES(true,$1,$2,$3,$4,'STAGING') ON CONFLICT(singleton) DO UPDATE SET run_id=EXCLUDED.run_id,source_id=EXCLUDED.source_id,generation=EXCLUDED.generation,capability_hash=EXCLUDED.capability_hash,mode=EXCLUDED.mode RETURNING ${columns}`,[runId,sourceId,generation,hash(token)])).rows[0];
  const proof=await witness(client,row);await client.query('COMMIT');return {pool:guardedPool(pool,token),witness:proof};
 }catch(error){try{await client.query('ROLLBACK')}catch(e){broken=e}throw error}finally{client.release(broken)}
}
export async function assertBookPostgresFence(options){
 validate(options);const {pool,runId,sourceId,generation}=options;const client=await pool.connect();let broken;
 try{
  await client.query('BEGIN');const rows=(await client.query(`SELECT ${columns} FROM mu_book_cutover_guard FOR SHARE`)).rows;
  const row=rows[0];if(rows.length!==1||row.run_id!==runId.toLowerCase()||row.source_id!==sourceId||Number(row.generation)!==generation||row.mode!=='STAGING'||!/^[a-f0-9]{64}$/.test(row.capability_hash))throw Error('Book fence mismatch');
  const metadata=(await client.query('SELECT version,max_attempts FROM mu_book_queue FOR SHARE')).rows;
  if(metadata.length!==1||metadata[0].version!==1||!Number.isInteger(metadata[0].max_attempts)||metadata[0].max_attempts<1||metadata[0].max_attempts>10||(options.maxAttempts!==undefined&&metadata[0].max_attempts!==options.maxAttempts))throw Error('Book fence metadata mismatch');
  const proof=await witness(client,row);await client.query('COMMIT');return proof;
 }catch(error){try{await client.query('ROLLBACK')}catch(e){broken=e}throw error}finally{client.release(broken)}
}
