// Transactional PostgreSQL queue. No worker code execution or implicit network access.
import {createHash} from 'node:crypto';
const kinds=new Set(['extract-pages','analyze-knowledge','propose-adapter','verify-candidate']);
function str(v,label,max=200){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid '+label);return v.trim()}
export function createIngestionJobStore(pool){
 if(!pool||typeof pool.query!=='function')throw Error('PostgreSQL pool required');
 return Object.freeze({
  async enqueue({kind,sourceHash,locator,version='v1',payload={}}){
   if(!kinds.has(kind))throw Error('Invalid job kind');
   const identity=[kind,str(sourceHash,'source hash'),str(locator,'locator'),str(version,'version')];
   if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid payload');
   const key=createHash('sha256').update(JSON.stringify(identity)).digest('hex');
   const result=await pool.query(
    'INSERT INTO mu_ingestion_jobs (idempotency_key,kind,payload) VALUES ($1,$2,$3::jsonb) ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING job_id,state,idempotency_key',
    [key,kind,JSON.stringify(payload)]
   );
   return result.rows[0];
  },
  async claim({workerId,leaseSeconds=120}){
   workerId=str(workerId,'worker id');
   if(!Number.isInteger(leaseSeconds)||leaseSeconds<10||leaseSeconds>3600)throw Error('Invalid lease');
   // Single statement ensures row locking, atomic claim and no double ownership.
   const result=await pool.query(`
WITH candidate AS (
 SELECT job_id FROM mu_ingestion_jobs
 WHERE ((state='queued' AND available_at<=now()) OR (state='running' AND lease_until<now()))
   AND attempts<max_attempts
 ORDER BY available_at,job_id
 FOR UPDATE SKIP LOCKED LIMIT 1
)
UPDATE mu_ingestion_jobs AS job SET state='running',attempts=job.attempts+1,
 worker_id=$1,lease_until=now()+($2::int*interval '1 second'),updated_at=now()
FROM candidate WHERE job.job_id=candidate.job_id
RETURNING job.job_id,job.kind,job.payload,job.attempts,job.lease_until`,[workerId,leaseSeconds]);
   return result.rows[0]??null;
  },
  async complete({jobId,workerId,result={}}){
   workerId=str(workerId,'worker id');
   if(!Number.isSafeInteger(jobId)||jobId<1||!result||typeof result!=='object'||Array.isArray(result))throw Error('Invalid completion');
   const res=await pool.query(
    "UPDATE mu_ingestion_jobs SET state='completed',result=$3::jsonb,lease_until=NULL,updated_at=now() WHERE job_id=$1 AND state='running' AND worker_id=$2 AND lease_until>now() RETURNING job_id",
    [jobId,workerId,JSON.stringify(result)]
   );
   if(!res.rows.length)throw Error('Job lease expired or not owned');
   return res.rows[0];
  },
  async fail({jobId,workerId,error,retrySeconds=60}){
   workerId=str(workerId,'worker id');error=str(error,'error',1000);
   if(!Number.isSafeInteger(jobId)||jobId<1||!Number.isInteger(retrySeconds)||retrySeconds<1||retrySeconds>86400)throw Error('Invalid retry');
   const res=await pool.query(`
UPDATE mu_ingestion_jobs SET
 state=CASE WHEN attempts>=max_attempts THEN 'failed' ELSE 'queued' END,
 available_at=now()+($4::int*interval '1 second'),lease_until=NULL,worker_id=NULL,
 last_error=$3,updated_at=now()
WHERE job_id=$1 AND state='running' AND worker_id=$2 AND lease_until>now()
RETURNING job_id,state`,[jobId,workerId,error,retrySeconds]);
   if(!res.rows.length)throw Error('Job lease expired or not owned');
   return res.rows[0];
  }
 });
}
