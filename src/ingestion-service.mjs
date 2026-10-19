// Standalone Windows-compatible ingestion entrypoint. Requires separately installed pg.
// Start from a restricted service account; never store credentials in source control.
import {createFencedIngestionJobStore} from './ingestion-job-postgres-fenced.mjs';
import {createIngestionJobStore} from './ingestion-job-postgres.mjs';
import {createIngestionWorker} from './ingestion-worker.mjs';
import {createIngestionSupervisor} from './ingestion-supervisor.mjs';
// Explicit administrative action, never called by service startup. Requires the
// additive protocol migration and no running leases; it permanently fences legacy DML.
export async function enableFencedIngestionService(pool){
 if(!pool||typeof pool.connect!=='function')throw Error('PostgreSQL pool with connect() required');
 const client=await pool.connect();let active=false,releaseError;
 try{
  await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');active=true;
  await client.query('SELECT mu_enable_fenced_ingestion()');
  await client.query('COMMIT');active=false;
 }catch(error){if(active)try{await client.query('ROLLBACK')}catch(e){releaseError=e}throw error;}
 finally{client.release(releaseError);}
}
export async function startIngestionService({env=process.env,handlers={},loadPg=()=>import('pg'),onError=console.error}={}){
 const url=env.MATH_UNIVERSE_DATABASE_URL;
 if(typeof url!=='string'||!url.trim())throw Error('MATH_UNIVERSE_DATABASE_URL is required');
 const mode=env.MATH_UNIVERSE_INGESTION_MODE||'legacy';
 if(!['legacy','fenced'].includes(mode))throw Error('Invalid ingestion mode');
 const workerId=env.MATH_UNIVERSE_WORKER_ID||'math-universe-local';
 const concurrency=Number(env.MATH_UNIVERSE_CONCURRENCY||1);
 const {default:pg}=await loadPg();
 if(typeof pg?.Pool!=='function')throw Error('pg Pool is required');
 const pool=new pg.Pool({connectionString:url,max:Math.max(1,concurrency+1),connectionTimeoutMillis:5000,idleTimeoutMillis:30000});

 let supervisor;
 try{
  await pool.query('SELECT 1');
  if(mode==='fenced'){
   let protocol;try{protocol=await pool.query('SELECT mu_ingestion_protocol_status() AS mode');}
   catch{throw Error('Fenced ingestion protocol migration and explicit activation required');}
   if(protocol.rows.length!==1||protocol.rows[0].mode!=='fenced')throw Error('Fenced ingestion protocol activation required');
  }
  const store=mode==='fenced'?createFencedIngestionJobStore(pool):createIngestionJobStore(pool);
  const worker=createIngestionWorker({store,handlers,workerId,concurrency,onError});
  supervisor=createIngestionSupervisor({worker,onError});
  const running=supervisor.start();
  let stopping;
  const stop=()=>{if(!stopping)stopping=(async()=>{await supervisor.shutdown();await pool.end()})();return stopping};
  return {stop,running,status:()=>supervisor.status()};
 }catch(error){await pool.end();throw error}
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1].replaceAll('\\','/')).href){
 startIngestionService().then(service=>{
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{service.stop().then(()=>process.exit(0),error=>{console.error(error);process.exitCode=1})});
 }).catch(error=>{console.error(error);process.exitCode=1});
}
