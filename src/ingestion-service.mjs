// Standalone Windows-compatible ingestion entrypoint. Requires separately installed pg.
// Start from a restricted service account; never store credentials in source control.
import {createIngestionJobStore} from './ingestion-job-postgres.mjs';
import {createIngestionWorker} from './ingestion-worker.mjs';
import {createIngestionSupervisor} from './ingestion-supervisor.mjs';
export async function startIngestionService({env=process.env,handlers={},loadPg=()=>import('pg'),onError=console.error}={}){
 const url=env.MATH_UNIVERSE_DATABASE_URL;
 if(typeof url!=='string'||!url.trim())throw Error('MATH_UNIVERSE_DATABASE_URL is required');
 const workerId=env.MATH_UNIVERSE_WORKER_ID||'math-universe-local';
 const concurrency=Number(env.MATH_UNIVERSE_CONCURRENCY||1);
 const {default:pg}=await loadPg();
 if(typeof pg?.Pool!=='function')throw Error('pg Pool is required');
 const pool=new pg.Pool({connectionString:url,max:Math.max(1,concurrency+1),connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
 const store=createIngestionJobStore(pool);
 let supervisor;
 try{
  await pool.query('SELECT 1');
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
