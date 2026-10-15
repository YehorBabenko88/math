// Opt-in fenced queue operations. Do not mix with legacy unfenced workers.
// Requires sql/003_ingestion_claim_fencing.sql and a drained legacy queue.
import {randomUUID} from 'node:crypto';
function validToken(token){if(typeof token!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))throw Error('Valid claim token required');return token}
function validId(id){if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid job id');return id}
function validWorker(id){if(typeof id!=='string'||!id.trim()||id.length>128)throw Error('Invalid worker id');return id}
function validLease(n){if(!Number.isInteger(n)||n<10||n>3600)throw Error('Invalid lease duration');return n}
export function createFencedIngestionJobStore(pool){
 if(!pool||typeof pool.query!=='function')throw Error('PostgreSQL pool required');
 return Object.freeze({
  async claim({workerId,leaseSeconds=120}){
   validWorker(workerId);validLease(leaseSeconds);
   const token=randomUUID();
   const res=await pool.query(`
WITH candidate AS (
 SELECT job_id FROM mu_ingestion_jobs
 WHERE ((state='queued' AND available_at<=now()) OR (state='running' AND lease_until<now()))
 AND attempts<max_attempts
 ORDER BY available_at,job_id FOR UPDATE SKIP LOCKED LIMIT 1
)
UPDATE mu_ingestion_jobs AS job
 SET state='running',attempts=job.attempts+1,worker_id=$1,claim_token=$3::uuid,
 lease_until=now()+($2::int*interval '1 second'),updated_at=now()
FROM candidate WHERE job.job_id=candidate.job_id
RETURNING job.job_id,job.kind,job.payload,job.attempts,job.lease_until,job.claim_token`,[workerId,leaseSeconds,token]);
   return res.rows[0]??null;
  },
  async renew({jobId,workerId,claimToken,leaseSeconds=120}){
   validId(jobId);validWorker(workerId);validToken(claimToken);validLease(leaseSeconds);
   const res=await pool.query("UPDATE mu_ingestion_jobs SET lease_until=now()+($4::int*interval '1 second'),updated_at=now() WHERE job_id=$1 AND worker_id=$2 AND claim_token=$3::uuid AND state='running' AND lease_until>now() RETURNING job_id,lease_until",[jobId,workerId,claimToken,leaseSeconds]);
   if(!res.rows.length)throw Error('Job lease expired or not owned');
   return res.rows[0];
  },
  async complete({jobId,workerId,claimToken,result={}}){
   validId(jobId);validWorker(workerId);validToken(claimToken);
   if(!result||typeof result!=='object'||Array.isArray(result))throw Error('Invalid result');
   const res=await pool.query("UPDATE mu_ingestion_jobs SET state='completed',result=$4::jsonb,lease_until=NULL,claim_token=NULL,worker_id=NULL,updated_at=now() WHERE job_id=$1 AND worker_id=$2 AND claim_token=$3::uuid AND state='running' AND lease_until>now() RETURNING job_id",[jobId,workerId,claimToken,JSON.stringify(result)]);
   if(!res.rows.length)throw Error('Job lease expired or not owned');
   return res.rows[0];
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
   if(!res.rows.length)throw Error('Job lease expired or not owned');
   return res.rows[0];
  }
 });
}
