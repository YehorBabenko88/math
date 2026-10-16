// Explicit adapter boundary between the local Book SQLite queue and the
// distributed Math Universe PostgreSQL queue. This does not perform migration.
export function assessBookQueueCompatibility({bookJob,postgresClaim}){
 if(!bookJob||typeof bookJob!=='object'||!postgresClaim||typeof postgresClaim!=='object')
  throw Error('Both queue records are required');
 const bookId=bookJob.bookId??bookJob.id;
 const sourceHash=bookJob.sourceHash??bookJob.source?.sha256;
 const token=bookJob.token??bookJob.leaseToken??bookJob.lease_token;
 if(typeof bookId!=='string'||!bookId||typeof sourceHash!=='string'||!sourceHash)
  throw Error('Book identity and provenance required');
 if(typeof token!=='string'||token.length<32)
  throw Error('Book claim fencing token required');
 if(!(Number.isSafeInteger(postgresClaim.job_id)&&postgresClaim.job_id>0)&&!(typeof postgresClaim.job_id==='string'&&/^[1-9]\d{0,18}$/.test(postgresClaim.job_id)&&BigInt(postgresClaim.job_id)<=9223372036854775807n))
  throw Error('PostgreSQL claim identity required');
 // Legacy claims have no acquisition token. Worker names are reusable.
 if(typeof postgresClaim.claim_token!=='string'||postgresClaim.claim_token.length<32)
  return Object.freeze({compatible:false,fullBookstoreSubstitution:false,reason:'postgres-claim-has-no-fencing-token',bookId,postgresJobId:postgresClaim.job_id});
 // Preserve the legacy reason code; the detailed blockers remain explicit even
 // when both queues support fenced checkpoints.
 return Object.freeze({compatible:false,fullBookstoreSubstitution:false,reason:'checkpoint-and-review-contract-not-implemented',missingContracts:Object.freeze(['identity-migration','review-persistence','snapshot-mapping']),bookId,postgresJobId:postgresClaim.job_id});
}
