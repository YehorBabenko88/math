import pg from 'pg';
import {createFencedIngestionJobStore} from '../../src/ingestion-job-postgres-fenced.mjs';
const schema=process.env.MU_TEST_SCHEMA;
if(!/^mu_it_[a-f0-9]{32}$/.test(schema??''))throw Error('Explicit isolated schema required');
const pool=new pg.Pool({connectionString:process.env.MATH_UNIVERSE_TEST_DATABASE_URL,options:'-c search_path='+schema,max:1});
try{
 const store=createFencedIngestionJobStore(pool);
 const claim=await store.claim({workerId:'crash-worker',jobId:Number(process.env.MU_TEST_JOB_ID),leaseSeconds:10});
 if(!claim)throw Error('Claim required');
 const checkpoint=JSON.parse(process.env.MU_TEST_CHECKPOINT);
 await store.checkpoint({jobId:Number(claim.job_id),workerId:'crash-worker',claimToken:claim.claim_token,checkpoint});
 process.stdout.write('CHECKPOINT_COMMITTED\n');
 setInterval(()=>{},1000); // Parent kills this process after durable acknowledgement.
}catch{
 await pool.end();process.stderr.write('Synthetic checkpoint worker failed\n');process.exitCode=1;
}
