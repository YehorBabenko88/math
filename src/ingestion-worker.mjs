// Bounded, explicit-handler job runner; never interprets job payload as code.
import {safeJson} from './book-ingestion/json.mjs';
function checkpointData(value){
 const data=safeJson(value,{maxBytes:256*1024});
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Checkpoint JSON object required');
 return data;
}
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
 // Error observers must not turn background renewal into an unhandled rejection.
 const reportError=error=>{try{Promise.resolve(onError(error)).catch(()=>{})}catch{}};
 let stopped=false;
 let active=0;
 const tasks=new Set();
 async function processOne(){
  if(stopped)return false;
  const job=await store.claim({workerId,leaseSeconds});
  if(!job)return false;
  const jobId=typeof job.job_id==='string'&&/^[1-9]\d*$/.test(job.job_id)?Number(job.job_id):job.job_id;
  if(!Number.isSafeInteger(jobId)||jobId<1){reportError(Error('Invalid claimed job ID'));return true;}
  const fn=Object.hasOwn(handlers,job.kind)?handlers[job.kind]:undefined;
  const claimArgs=Object.hasOwn(job,'claim_token')?{claimToken:job.claim_token}:{};
  const abortController=new AbortController();
  let lostLease=false,handlerCompleted=false;
  const markLeaseLost=error=>{if(error?.code==='JOB_LEASE_LOST'){lostLease=true;abortController.abort();}};
  const checkpointWrites=new Set();let checkpointFailed=false,checkpointError;
  const settleCheckpoints=()=>Promise.allSettled([...checkpointWrites]);
  let heartbeatInFlight=Promise.resolve();
  const timer=setInterval(()=>{
   heartbeatInFlight=heartbeatInFlight.then(async()=>{
    if(lostLease||abortController.signal.aborted)return;
    try{await store.renew({jobId,workerId,leaseSeconds,...claimArgs})}
    catch(error){lostLease=true;abortController.abort();reportError(error)}
   }).catch(error=>{lostLease=true;abortController.abort();reportError(error)});
  },heartbeatMs);
  try{
   if(typeof fn!=='function')throw Error('No registered handler for job kind');
   const saveCheckpoint=checkpoint=>{
    try{
     if(handlerCompleted||lostLease||abortController.signal.aborted)throw Error('Checkpoint requires an active job lease');
     if(typeof store.checkpoint!=='function')throw Error('Job store does not support checkpoints');
     const data=checkpointData(checkpoint);
     const operation=Promise.resolve().then(()=>{
      if(lostLease||abortController.signal.aborted)throw Error('Checkpoint requires an active job lease');
      return store.checkpoint({jobId,workerId,...claimArgs,checkpoint:data});
     });
     checkpointWrites.add(operation);
     operation.then(()=>checkpointWrites.delete(operation),error=>{checkpointWrites.delete(operation);checkpointFailed=true;checkpointError=error;markLeaseLost(error)});
     return operation;
    }catch(error){const rejected=Promise.reject(error);rejected.catch(()=>{});return rejected;}
   };
   let output;
   try{output=await fn(structuredClone(job.payload),{jobId,attempt:job.attempts,signal:abortController.signal,checkpoint:job.checkpoint==null?null:checkpointData(job.checkpoint),saveCheckpoint});}
   finally{handlerCompleted=true;}
   if(!output||typeof output!=='object'||Array.isArray(output))throw Error('Handler must return a result object');
   await settleCheckpoints();
   if(checkpointFailed)throw checkpointError;
   clearInterval(timer);
   await heartbeatInFlight;
   if(lostLease)throw Error('Job lease renewal failed');
   await store.complete({jobId,workerId,result:output,...claimArgs});
  }catch(error){
   markLeaseLost(error);
   abortController.abort();
   await settleCheckpoints();
   clearInterval(timer);
   await heartbeatInFlight;
   if(lostLease){reportError(error);return true}
   try{await store.fail({jobId,workerId,error:String(error?.message??error).slice(0,1000),...claimArgs})}
   catch(failure){markLeaseLost(failure);reportError(failure)}
   reportError(error);
  }finally{clearInterval(timer);abortController.abort()}
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
