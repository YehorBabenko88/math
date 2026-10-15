// Explicit adapter boundary between the local Book SQLite queue and the
// distributed Math Universe PostgreSQL queue. This does not perform migration.
export function assessBookQueueCompatibility({bookJob,postgresClaim}){
 if(!bookJob||typeof bookJob!=='object'||!postgresClaim||typeof postgresClaim!=='object')
  throw Error('Both queue records are required');
 const bookId=bookJob.bookId??bookJob.id;
 const sourceHash=bookJob.sourceHash??bookJob.source?.sha256;
 const token=bookJob.leaseToken??bookJob.lease_token;
 if(typeof bookId!=='string'||!bookId||typeof sourceHash!=='string'||!sourceHash)
  throw Error('Book identity and provenance required');
 if(typeof token!=='string'||token.length<32)
  throw Error('Book claim fencing token required');
 if(!Number.isSafeInteger(postgresClaim.job_id)||postgresClaim.job_id<1)
  throw Error('PostgreSQL claim identity required');
 // Current PostgreSQL claims expose no per-acquisition fencing token.
 // Reject even if worker_id matches: worker names are reusable.
 if(typeof postgresClaim.claim_token!=='string'||postgresClaim.claim_token.length<32)
  return Object.freeze({compatible:false,reason:'postgres-claim-has-no-fencing-token',bookId,postgresJobId:postgresClaim.job_id});
 return Object.freeze({compatible:false,reason:'checkpoint-and-review-contract-not-implemented',bookId,postgresJobId:postgresClaim.job_id});
}
