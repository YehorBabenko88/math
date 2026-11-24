// Resilient standalone poll loop for an injected scientific ingestion worker.
// No database connection or operating-system service is created by this module.
export function createIngestionSupervisor({worker,pollMs=1000,maxBackoffMs=30000,onError=()=>{},sleep=(ms,signal)=>new Promise(resolve=>{
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},ms);
 function abort(){clearTimeout(timer);resolve()}
 signal?.addEventListener('abort',abort,{once:true});
})}){
 if(!worker||typeof worker.tick!=='function'||typeof worker.stop!=='function'||typeof worker.drain!=='function')throw Error('Invalid worker');
 if(!Number.isInteger(pollMs)||pollMs<100||pollMs>60000||!Number.isInteger(maxBackoffMs)||maxBackoffMs<pollMs||maxBackoffMs>300000)throw Error('Invalid polling intervals');
 let stopped=false,loop=null,failures=0;
 const controller=new AbortController();
 async function run(){
  while(!stopped){
   try{
    await worker.tick();
    failures=0;
    if(!stopped)await sleep(pollMs,controller.signal);
   }catch(error){
    onError(error);
    failures=Math.min(failures+1,16);
    const delay=Math.min(maxBackoffMs,pollMs*2**Math.min(failures-1,12));
    if(!stopped)await sleep(delay,controller.signal);
   }
  }
 }
 return Object.freeze({
  start(){if(loop)return loop;loop=run();return loop},
  stop(){if(stopped)return;stopped=true;controller.abort();worker.stop()},
  async shutdown(){this.stop();if(loop)await loop;await worker.drain()},
  status(){return {stopped,failures,running:!!loop}}
 });
}
