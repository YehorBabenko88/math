import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const c=JSON.parse(process.env.Q01_WORKER_CONFIG),parent=c.parentPid;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const send=message=>new Promise(resolve=>{if(process.connected)process.send(message,()=>resolve());else resolve();});
function alive(){try{process.kill(parent,0);}catch{throw Error('LAB_PARENT_LOST');}}
const input=page=>({sourceHash:'a'.repeat(64),edition:'Synthetic Q01',page,extractionVersion:'lab-v1',payload:{synthetic:true}});
const errorKind=e=>['Invalid queue state','Invalid queue directory','Lease rejected','Invalid queue input'].includes(e.message)?e.message:'LAB_WORKER_ERROR';
let completed=false;process.on('disconnect',()=>{if(!completed)process.exit(2);});
await send({kind:'ready',data:{pid:process.pid}});
await new Promise(resolve=>process.once('message',message=>{if(message?.command==='start')resolve();}));
let result;
try{
 alive();
 let queueURL=pathToFileURL(join(c.source,'src/book-ingestion/queue.mjs')).href;
 if(c.copyPassive){const {diagnosticQueueURL}=await import('./passive-source.mjs');queueURL=diagnosticQueueURL(readFileSync(join(c.source,'src/book-ingestion/queue.mjs')),pathToFileURL(join(c.source,'src/book-ingestion/queue-contract.mjs')).href,pathToFileURL(join(c.source,'src/book-ingestion/sqlite-text.mjs')).href);}
 const {openBookQueue}=await import(queueURL);
 const open=()=>openBookQueue({directory:c.directory,...(c.now===undefined?{}:{now:()=>c.now})});
 if(c.role==='hold'){
  const db=new DatabaseSync(join(c.directory,'queue.sqlite'));
  try{db.exec('BEGIN IMMEDIATE');await send({kind:'barrier',data:{phase:'native-lock-held'}});await new Promise(resolve=>process.once('message',m=>{if(m?.command==='release')resolve();}));db.exec('COMMIT');result={ok:true};}finally{db.close();}
 }else if(c.role==='inspect'){
  const db=new DatabaseSync(join(c.directory,'queue.sqlite'),{readOnly:true});
  try{
   const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(x=>x.name);
   const integrity=db.prepare('PRAGMA integrity_check').all().map(r=>Object.values(r)[0]);
   const metadata=tables.includes('queue_metadata')?db.prepare('SELECT * FROM queue_metadata').all():[];
   const count=tables.includes('jobs')?db.prepare('SELECT count(*) AS n FROM jobs').get().n:0;
   result={ok:true,tables,integrity,metadata,count,columns:tables.includes('jobs')?db.prepare('PRAGMA table_info(jobs)').all().map(x=>({name:x.name,type:x.type})):[]};
  }finally{db.close();}
 }else if(c.role==='corrupt'){
  const db=new DatabaseSync(join(c.directory,'queue.sqlite'));
  const statements={schema:'DROP TABLE jobs',version:'UPDATE queue_metadata SET version=99',metadata:'DELETE FROM queue_metadata',payload:"UPDATE jobs SET payload='{broken'",types:"UPDATE jobs SET attempts='invalid'"};
  try{if(!Object.hasOwn(statements,c.corruption))throw Error('LAB_ROLE');db.exec(statements[c.corruption]);result={ok:true};}finally{db.close();}
 }else{
  await send({kind:'phase',data:{phase:'open-start'}});
  const q=await open();await send({kind:'phase',data:{phase:'open-finished'}});
  switch(c.role){
   case 'open':result={ok:true,snapshot:await q.exportSnapshot()};break;
   case 'pair':{
    const job=await q.enqueue(input(1)),lease=await q.acquire({workerId:'synthetic-worker',leaseMs:60000});result={ok:true,id:job.id,acquired:lease!==null};break;
   }
   case 'seed':for(let page=1;page<=(c.count??1);page++){alive();await q.enqueue(input(page));}result={ok:true,snapshot:await q.exportSnapshot()};break;
   case 'enqueue':await q.enqueue(input(c.page??1));result={ok:true,snapshot:await q.exportSnapshot()};break;
   case 'multiwriter':for(let page=c.first;page<c.first+c.count;page++){alive();await q.enqueue(input(page));}result={ok:true};break;
   case 'claims':{
    const ids=[];for(;;){alive();const lease=await q.acquire({workerId:'synthetic-worker',leaseMs:60000});if(!lease)break;await q.checkpoint(lease.id,lease.token,{stage:'claimed'});await q.complete(lease.id,lease.token,{result:{synthetic:true},metrics:{checks:1}});ids.push(lease.id);}result={ok:true,ids};break;
   }
   case 'lease':{
    const job=await q.enqueue(input(1)),lease=await q.acquire({workerId:'same',leaseMs:10,jobId:job.id});await q.checkpoint(job.id,lease.token,{stage:'checkpoint',unicode:'x\u0000\ud800'});result={ok:true,jobId:job.id,token:lease.token,tokenDigest:hash(lease.token),snapshot:await q.exportSnapshot()};break;
   }
   case 'reissue':{
    const before=await q.exportSnapshot(),lease=await q.acquire({workerId:'same',leaseMs:100});let rejected=0;const stable=await q.exportSnapshot();
    for(const fn of [()=>q.complete(c.jobId,c.oldToken,{result:{},metrics:{}}),()=>q.renew(c.jobId,c.oldToken,{leaseMs:100}),()=>q.checkpoint(c.jobId,c.oldToken,{}),()=>q.fail(c.jobId,c.oldToken,{code:'OLD'})]){try{await fn();}catch(e){if(e.message==='Lease rejected')rejected++;else throw e;}}
    const after=await q.exportSnapshot();result={ok:true,rejected,unchanged:hash(stable)===hash(after),attempts:lease.attempts,rotated:hash(lease.token)!==hash(c.oldToken),checkpoint:lease.checkpoint,before};break;
   }
   case 'unicode':{
    const data={...input(1),edition:'e\ud800\0',extractionVersion:'x\udfff',payload:{'ключ\0':['\ud800','x\u0000',{nested:true}]}};
    const job=await q.enqueue(data),lease=await q.acquire({workerId:'w\ud800',leaseMs:1000});await q.checkpoint(job.id,lease.token,{stage:'x\udfff\0'});await q.complete(job.id,lease.token,{result:{unicode:data.payload},metrics:{checks:1}});const second=await open();const loaded=await second.get(job.id);result={ok:true,equal:hash(loaded)===hash(await q.get(job.id)),sourceEqual:loaded.edition===data.edition&&loaded.extractionVersion===data.extractionVersion&&hash(loaded.payload)===hash(data.payload),snapshot:await q.exportSnapshot()};break;
   }
   case 'idempotence':{
    const a=await q.enqueue(input(1)),b=await q.enqueue({...input(1),payload:{changed:true}});result={ok:true,same:a.id===b.id,original:hash(a.payload)===hash(b.payload),count:(await q.list()).length};break;
   }
   default:throw Error('LAB_ROLE');
  }
 }
}catch(error){result={ok:false,error:errorKind(error),code:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'REDACTED'};}
await send({kind:'result',result,data:{ok:result.ok,kind:result.error??'success',code:result.code??'none'}});completed=true;
process.disconnect();
