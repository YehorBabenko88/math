import {Worker} from 'node:worker_threads';
/** Isolated source-owned engine work. Callers supply observations, never commands. */
export function runBoundedExperiment(payload,{signal,timeoutMs=3000}={}) {
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000) return Promise.reject(Error('INVALID_DEADLINE'));
 if(signal?.aborted)return Promise.reject(Error('CANCELLED'));
 const encoded=JSON.stringify(payload);
 if(!encoded||Buffer.byteLength(encoded)>262144)return Promise.reject(Error('BODY_LIMIT'));
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./bounded-experiment-worker.mjs',import.meta.url),{workerData:payload,resourceLimits:{maxOldGenerationSizeMb:64,stackSizeMb:4}});
  let done=false;
  const finish=(err,result)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);worker.terminate();err?reject(err):resolve(result)};
  const cancel=()=>finish(Error('CANCELLED'));
  const timer=setTimeout(()=>finish(Error('DEADLINE_EXCEEDED')),timeoutMs);
  signal?.addEventListener('abort',cancel,{once:true});
  worker.once('message',message=>message.error?finish(Error(message.error)):finish(null,message.result));
  worker.once('error',err=>finish(err));
  worker.once('exit',code=>{if(!done)finish(Error('WORKER_EXIT_'+code))});
 });
}
