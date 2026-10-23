// Opt-in local synthetic benchmark; never runs in CI by default.
// Usage: node tools/bench-book-queue-rewrite.mjs [jobs=100] [iterations=20]
import {performance} from 'node:perf_hooks';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';

const [jobsArg='100',iterationsArg='20']=process.argv.slice(2);
function bounded(value,min,max){const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid benchmark argument');return n;}
const jobs=bounded(jobsArg,1,999),iterations=bounded(iterationsArg,1,100);
if(jobs+iterations>1000)throw Error('Benchmark exceeds queue MAX_JOBS=1000; reduce jobs or iterations');
const directory=mkdtempSync(join(tmpdir(),'math-q01-bench-'));
const samples=[],readSamples=[];
function summary(values){const sorted=[...values].sort((a,b)=>a-b);const q=p=>sorted[Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1)];return {p50Ms:q(.5),p95Ms:q(.95),maxMs:sorted.at(-1)};}
try{
 const q=await openBookQueue({directory});
 const sourceHash='a'.repeat(64);
 for(let i=0;i<jobs;i++)await q.enqueue({sourceHash,edition:'Synthetic benchmark',page:i+1,extractionVersion:'bench-v1',payload:{sample:'x'.repeat(128)}});
 for(let i=0;i<iterations;i++){
  const readStart=performance.now();
  await q.list();
  readSamples.push(performance.now()-readStart);
  const start=performance.now();
  await q.enqueue({sourceHash,edition:'Synthetic benchmark',page:jobs+i+1,extractionVersion:'bench-v1',payload:{sample:'x'.repeat(128)}});
  samples.push(performance.now()-start);
 }
 const db=new DatabaseSync(join(directory,'queue.sqlite'));
 let integrity;
 try{integrity=db.prepare('PRAGMA integrity_check').get().integrity_check;}
 finally{db.close();}
 if(integrity!=='ok')throw Error('SQLite integrity check failed');
 console.log(JSON.stringify({kind:'synthetic-sqlite-queue-rewrite',jobsBefore:jobs,iterations,platform:process.platform,node:process.version,read:summary(readSamples),write:summary(samples),sqliteIntegrity:integrity,note:'Synthetic only; operations are synchronous DatabaseSync and these are wall-clock samples, not SQLite lock-duration measurements'},null,2));
}finally{rmSync(directory,{recursive:true,force:true});}
