// Opt-in fenced queue operations. Do not mix with legacy unfenced workers.
// Requires migrations through 004_ingestion_checkpoints.sql and a drained legacy queue.
// Job IDs must fit positive JavaScript safe integers; unsupported database IDs are untouched.
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
function validToken(token){if(typeof token!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))throw Error('Valid claim token required');return token}
function validId(id){if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid job id');return id}
function validWorker(id){if(typeof id!=='string'||!id.trim()||id.length>128)throw Error('Invalid worker id');return id}
function validLease(n){if(!Number.isInteger(n)||n<10||n>3600)throw Error('Invalid lease duration');return n}
function jobRow(row){return {...row,job_id:validId(typeof row.job_id==='string'&&/^[1-9]\d*$/.test(row.job_id)?Number(row.job_id):row.job_id)}}
function leaseLost(){return Object.assign(Error('Job lease expired or not owned'),{code:'JOB_LEASE_LOST'})}
function boundedJSON(input,label){
 const limit=256*1024,active=new Set();let nodes=0,bytes=0;
 const add=n=>{bytes+=n;if(bytes>limit)throw Error(`${label} JSON size limit`)};
 function visit(value,depth){
  if(++nodes>20000||depth>24)throw Error(`${label} JSON complexity limit`);
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)){add(Buffer.byteLength(JSON.stringify(value)));return value}
  if(typeof value==='string'){if(value.length>limit)throw Error(`${label} JSON size limit`);add(Buffer.byteLength(JSON.stringify(value)));return value}
  if(!value||typeof value!=='object'||types.isProxy(value)||active.has(value))throw Error(`Invalid ${label.toLowerCase()} JSON`);
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw Error(`Invalid ${label.toLowerCase()} JSON prototype`);
  const keys=Reflect.ownKeys(value);
  if(keys.length>20000||array&&(value.length>20000||keys.length!==value.length+1))throw Error(`Invalid ${label.toLowerCase()} JSON collection`);
  active.add(value);const result=array?[]:{};add(2);let count=0;
  for(const key of keys){
   if(array&&key==='length')continue;
   if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)||array&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length))throw Error(`Invalid ${label.toLowerCase()} JSON key`);
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))throw Error(`Invalid ${label.toLowerCase()} JSON accessor`);
   if(count++)add(1);
   if(!array){if(key.length>limit)throw Error(`${label} JSON size limit`);add(Buffer.byteLength(JSON.stringify(key))+1)}
   result[key]=visit(descriptor.value,depth+1);
  }
  active.delete(value);return result;
 }
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error(`${label} JSON object required`);
 return JSON.stringify(visit(input,0));
}
export function createFencedIngestionJobStore(pool){
 if(!pool||typeof pool.query!=='function')throw Error('PostgreSQL pool required');
 return Object.freeze({
  async claim({workerId,leaseSeconds=120,jobId}){
   validWorker(workerId);validLease(leaseSeconds);if(jobId!==undefined)validId(jobId);
   const token=randomUUID();
   const res=await pool.query(`
WITH exhausted AS (
 UPDATE mu_ingestion_jobs SET state='failed',lease_until=NULL,claim_token=NULL,
 worker_id=NULL,last_error='LEASE_EXPIRED',updated_at=now()
 WHERE job_id IN (
  SELECT job_id FROM mu_ingestion_jobs WHERE state='running' AND lease_until<=now()
  AND job_id BETWEEN 1 AND 9007199254740991
  AND attempts>=max_attempts AND ($4::bigint IS NULL OR job_id=$4::bigint)
  FOR UPDATE SKIP LOCKED
 ) RETURNING job_id
), candidate AS (
 SELECT job_id FROM mu_ingestion_jobs
 WHERE ((state='queued' AND available_at<=now()) OR (state='running' AND lease_until<=now()))
 AND job_id BETWEEN 1 AND 9007199254740991
 AND attempts<max_attempts AND ($4::bigint IS NULL OR job_id=$4::bigint)
 ORDER BY available_at,job_id FOR UPDATE SKIP LOCKED LIMIT 1
)
UPDATE mu_ingestion_jobs AS job
 SET state='running',attempts=job.attempts+1,worker_id=$1,claim_token=$3::uuid,
 lease_until=now()+($2::int*interval '1 second'),updated_at=now()
FROM candidate WHERE job.job_id=candidate.job_id
RETURNING job.job_id,job.kind,job.payload,job.attempts,job.lease_until,job.claim_token,job.worker_id,job.checkpoint`,[workerId,leaseSeconds,token,jobId??null]);
   return res.rows.length?jobRow(res.rows[0]):null;
  },
  async renew({jobId,workerId,claimToken,leaseSeconds=120}){
   validId(jobId);validWorker(workerId);validToken(claimToken);validLease(leaseSeconds);
   const res=await pool.query("UPDATE mu_ingestion_jobs SET lease_until=now()+($4::int*interval '1 second'),updated_at=now() WHERE job_id=$1 AND worker_id=$2 AND claim_token=$3::uuid AND state='running' AND lease_until>now() RETURNING job_id,lease_until",[jobId,workerId,claimToken,leaseSeconds]);
   if(!res.rows.length)throw leaseLost();
   return jobRow(res.rows[0]);
  },
  async checkpoint({jobId,workerId,claimToken,checkpoint}){
   validId(jobId);validWorker(workerId);validToken(claimToken);
   const encoded=boundedJSON(checkpoint,'Checkpoint');
   const res=await pool.query("UPDATE mu_ingestion_jobs SET checkpoint=$4::jsonb,updated_at=now() WHERE job_id=$1 AND worker_id=$2 AND claim_token=$3::uuid AND state='running' AND lease_until>now() RETURNING job_id,checkpoint",[jobId,workerId,claimToken,encoded]);
   if(!res.rows.length)throw leaseLost();
   return jobRow(res.rows[0]);
  },
  async complete({jobId,workerId,claimToken,result={}}){
   validId(jobId);validWorker(workerId);validToken(claimToken);
   const encoded=boundedJSON(result,'Result');
   const res=await pool.query("UPDATE mu_ingestion_jobs SET state='completed',result=$4::jsonb,lease_until=NULL,claim_token=NULL,worker_id=NULL,updated_at=now() WHERE job_id=$1 AND worker_id=$2 AND claim_token=$3::uuid AND state='running' AND lease_until>now() RETURNING job_id",[jobId,workerId,claimToken,encoded]);
   if(!res.rows.length)throw leaseLost();
   return jobRow(res.rows[0]);
  },
  async fail({jobId,workerId,claimToken,error,retrySeconds=60}){
   validId(jobId);validWorker(workerId);validToken(claimToken);
   if(typeof error!=='string'||!error.trim()||error.length>1000||!Number.isInteger(retrySeconds)||retrySeconds<1||retrySeconds>86400)throw Error('Invalid failure');
   const res=await pool.query(`UPDATE mu_ingestion_jobs SET
 state=CASE WHEN attempts>=max_attempts THEN 'failed' ELSE 'queued' END,
 available_at=now()+($5::int*interval '1 second'),lease_until=NULL,claim_token=NULL,
 worker_id=NULL,last_error=$4,updated_at=now()
 WHERE job_id=$1 AND worker_id=$2 AND claim_token=$3::uuid AND state='running' AND lease_until>now()
 RETURNING job_id,state`,[jobId,workerId,claimToken,error,retrySeconds]);
   if(!res.rows.length)throw leaseLost();
   return jobRow(res.rows[0]);
  }
 });
}
