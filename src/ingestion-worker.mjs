// Bounded, explicit-handler job runner; never interprets job payload as code.
const allowed=new Set(['extract-pages','analyze-knowledge','propose-adapter','verify-candidate']);
export function createIngestionWorker({store,handlers,workerId,concurrency=1,onError=()=>{},heartbeatMs=30000,leaseSeconds=120}){
 if(!store||typeof store.claim!=='function'||typeof store.complete!=='function'||typeof store.fail!=='function')throw Error('Invalid job store');
 if(!handlers||typeof handlers!=='object'||Array.isArray(handlers))throw Error('Invalid handlers');
 if(typeof workerId!=='string'||!workerId.trim()||workerId.length>128)throw Error('Invalid worker ID');
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('Invalid concurrency');
 if(!Number.isInteger(heartbeatMs)||heartbeatMs<100||heartbeatMs>=leaseSeconds*1000/2)throw Error('Invalid heartbeat interval');
 if(!Number.isInteger(leaseSeconds)||leaseSeconds<10||leaseSeconds>3600)throw Error('Invalid lease duration');
 if(typeof store.renew!=='function')throw Error('Job store must support lease renewal');
 for(const [name,fn] of Object.entries(handlers))if(!allowed.has(name)||typeof fn!=='function')throw Error('Invalid job handler');
 let stopped=false;
 let active=0;
 const tasks=new Set();
 async function processOne(){
  if(stopped)return false;
  const job=await store.claim({workerId,leaseSeconds});
  if(!job)return false;
  const fn=Object.hasOwn(handlers,job.kind)?handlers[job.kind]:undefined;
  const claimArgs=Object.hasOwn(job,'claim_token')?{claimToken:job.claim_token}:{};
  const abortController=new AbortController();
  let lostLease=false;
  let heartbeatInFlight=Promise.resolve();
  const timer=setInterval(()=>{
   heartbeatInFlight=heartbeatInFlight.then(async()=>{
    if(lostLease||abortController.signal.aborted)return;
    try{await store.renew({jobId:job.job_id,workerId,leaseSeconds,...claimArgs})}
    catch(error){lostLease=true;abortController.abort();onError(error)}
   }).catch(error=>{lostLease=true;abortController.abort();onError(error)});
  },heartbeatMs);
  timer.unref?.();
  try{
   if(typeof fn!=='function')throw Error('No registered handler for job kind');
   const output=await fn(structuredClone(job.payload),{jobId:job.job_id,attempt:job.attempts,signal:abortController.signal});
   if(!output||typeof output!=='object'||Array.isArray(output))throw Error('Handler must return a result object');
   clearInterval(timer);
   await heartbeatInFlight;
   if(lostLease)throw Error('Job lease renewal failed');
   await store.complete({jobId:job.job_id,workerId,result:output,...claimArgs});
  }catch(error){
   clearInterval(timer);
   abortController.abort();
   await heartbeatInFlight;
   if(lostLease){onError(error);return true}
   try{await store.fail({jobId:job.job_id,workerId,error:String(error?.message??error).slice(0,1000),...claimArgs})}
   catch(failure){onError(failure)}
   onError(error);
  }finally{clearInterval(timer)}
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
