import {isDeepStrictEqual} from 'node:util';
import {createBookQueueAPI,state,json,recover,assert,integer,reviewReceipt} from './queue-contract.mjs';
import {bookPostgresJSONCompatible} from './postgres-json.mjs';
const MAX_BYTES=8*1024*1024;

// Every writer (including imports) takes this singleton lock before reading jobs.
// The caller owns migrations and pool lifetime; this module never changes schema.
export async function transactionBookSnapshot(pool,{maxAttempts=3,now}={},fn){
 assert(pool&&typeof pool.connect==='function'&&integer(maxAttempts,1,10)&&typeof fn==='function');
 assert(now===undefined||typeof now==='function');
 const client=await pool.connect();let broken;
 try{
  await client.query('BEGIN');
  await client.query('INSERT INTO mu_book_queue(singleton,version,max_attempts) VALUES(true,1,$1) ON CONFLICT(singleton) DO NOTHING',[maxAttempts]);
  const meta=(await client.query('SELECT version,max_attempts FROM mu_book_queue WHERE singleton=true FOR UPDATE')).rows;
  assert(meta.length===1&&meta[0].version===1&&meta[0].max_attempts===maxAttempts,'Invalid queue state');
  const rows=(await client.query('SELECT postgres_id::text,sqlite_id,ordinal,document FROM mu_book_jobs ORDER BY ordinal')).rows;
  assert(rows.every((r,i)=>r.ordinal===i&&typeof r.postgres_id==='string'&&/^[1-9]\d*$/.test(r.postgres_id)&&r.sqlite_id===r.document?.id),'Invalid queue state');
  const document=state({schemaVersion:1,maxAttempts,jobs:rows.map(r=>r.document)},maxAttempts);
  const reviews=(await client.query('SELECT sqlite_id,candidate_digest,receipt FROM mu_book_reviews')).rows;
  const expected=document.jobs.filter(j=>j.result?.reviewReceipt);
  assert(reviews.length===expected.length&&reviews.every(r=>{const j=expected.find(j=>j.id===r.sqlite_id);return j&&r.candidate_digest===j.result.digest&&r.candidate_digest===r.receipt?.candidateDigest&&isDeepStrictEqual(json(r.receipt),json(j.result.reviewReceipt));}),'Invalid queue state');
  const before=new Map(document.jobs.map(j=>[j.id,JSON.stringify(j)]));
  const time=now===undefined?Number((await client.query('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS time')).rows[0].time):now();
  assert(integer(time,0,Number.MAX_SAFE_INTEGER-86400000),'Invalid queue clock');
  const result=await fn(document,time,client);
  const checked=state(document,maxAttempts);
  assert(bookPostgresJSONCompatible(checked),'Book PostgreSQL lossless JSON storage required');
  // Review fields are validated before any persistence, even when injected by a
  // migration callback rather than recordReview().
  for(const j of checked.jobs)if(j.result?.reviewReceipt){
   const r=j.result.reviewReceipt;
   assert(r.candidateDigest===j.result.digest&&/^[a-f0-9]{64}$/.test(r.candidateDigest),'Invalid queue state');
   reviewReceipt(r);
  }
  const ids=checked.jobs.map(j=>j.id);
  for(const row of rows)if(!ids.includes(row.sqlite_id))await client.query('DELETE FROM mu_book_jobs WHERE sqlite_id=$1',[row.sqlite_id]);
  // Free ordinals first when an import removes/reorders existing jobs.
  const reordered=rows.some(r=>ids.includes(r.sqlite_id)&&ids.indexOf(r.sqlite_id)!==r.ordinal);
  if(reordered)await client.query('UPDATE mu_book_jobs SET ordinal=ordinal+1000');
  for(const [ordinal,job] of checked.jobs.entries()){
   if(!before.has(job.id))await client.query('INSERT INTO mu_book_jobs(sqlite_id,ordinal,document) VALUES($1,$2,$3::jsonb)',[job.id,ordinal,JSON.stringify(job)]);
   else if(reordered||before.get(job.id)!==JSON.stringify(job))await client.query('UPDATE mu_book_jobs SET document=$2::jsonb,ordinal=$3 WHERE sqlite_id=$1',[job.id,JSON.stringify(job),ordinal]);
   const receipt=job.result?.reviewReceipt;
   if(receipt)await client.query('INSERT INTO mu_book_reviews(sqlite_id,candidate_digest,receipt) VALUES($1,$2,$3::jsonb) ON CONFLICT(sqlite_id) DO UPDATE SET candidate_digest=EXCLUDED.candidate_digest,receipt=EXCLUDED.receipt',[job.id,receipt.candidateDigest,JSON.stringify(receipt)]);
   else if(reviews.some(r=>r.sqlite_id===job.id))await client.query('DELETE FROM mu_book_reviews WHERE sqlite_id=$1',[job.id]);
  }
  const output=result===undefined?undefined:json(result,MAX_BYTES);
  await client.query('COMMIT');return output;
 }catch(error){try{await client.query('ROLLBACK')}catch(rollbackError){broken=rollbackError}throw error;}
 finally{client.release(broken);}
}

export async function openPostgresBookQueue(options={}){
 assert(options&&typeof options==='object'&&Object.getPrototypeOf(options)===Object.prototype);
 const descriptors=Object.getOwnPropertyDescriptors(options);
 assert(Reflect.ownKeys(descriptors).every(k=>['pool','now','maxAttempts'].includes(k)&&Object.hasOwn(descriptors[k],'value')));
 const {pool,now,maxAttempts=3}=options;
 const transaction=fn=>transactionBookSnapshot(pool,{now,maxAttempts},fn);
 await transaction((document,time)=>recover(document.jobs,time,maxAttempts));
 return {...createBookQueueAPI({transaction,maxAttempts}),async identityMap(){return transaction(async(d,time,client)=>(await client.query('SELECT sqlite_id,postgres_id::text FROM mu_book_jobs ORDER BY ordinal')).rows.map(r=>({sqliteId:r.sqlite_id,postgresId:r.postgres_id})))}};
}


