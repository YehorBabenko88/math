// Bounded, explicit-handler job runner; never interprets job payload as code.
const allowed=new Set(['extract-pages','analyze-knowledge','propose-adapter','verify-candidate']);
export function createIngestionWorker({store,handlers,workerId,concurrency=1,onError=()=>{}}){
 if(!store||typeof store.claim!=='function'||typeof store.complete!=='function'||typeof store.fail!=='function')throw Error('Invalid job store');
 if(!handlers||typeof handlers!=='object'||Array.isArray(handlers))throw Error('Invalid handlers');
 if(typeof workerId!=='string'||!workerId.trim()||workerId.length>128)throw Error('Invalid worker ID');
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('Invalid concurrency');
 for(const [name,fn] of Object.entries(handlers))if(!allowed.has(name)||typeof fn!=='function')throw Error('Invalid job handler');
 let stopped=false;
 let active=0;
 const tasks=new Set();
 async function processOne(){
  if(stopped)return false;
  const job=await store.claim({workerId});
  if(!job)return false;
  const fn=Object.hasOwn(handlers,job.kind)?handlers[job.kind]:undefined;
  try{
   if(typeof fn!=='function')throw Error('No registered handler for job kind');
   const output=await fn(structuredClone(job.payload),{jobId:job.job_id,attempt:job.attempts});
   if(!output||typeof output!=='object'||Array.isArray(output))throw Error('Handler must return a result object');
   await store.complete({jobId:job.job_id,workerId,result:output});
  }catch(error){
   try{await store.fail({jobId:job.job_id,workerId,error:String(error?.message??error).slice(0,1000)})}
   catch(failure){onError(failure)}
   onError(error);
  }
  return true;
 }
 async function tick(){
  if(stopped)return 0;
  let launched=0;
  while(!stopped&&active<concurrency){
   active++;
   const task=processOne().finally(()=>{active--;tasks.delete(task)});
   tasks.add(task);launched++;
  }
  await Promise.all([...tasks]);
  return launched;
 }
 return Object.freeze({
  tick,
  stop(){stopped=true},
  async drain(){await Promise.allSettled([...tasks])},
  status(){return {stopped,active,concurrency}}
 });
}
