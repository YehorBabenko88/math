// Opt-in local synthetic benchmark; never runs in CI by default.
// Usage: node tools/bench-book-queue-rewrite.mjs [jobs=100] [iterations=20]
import {performance} from 'node:perf_hooks';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';

const [jobsArg='100',iterationsArg='20']=process.argv.slice(2);
function bounded(value,min,max){const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid benchmark argument');return n;}
const jobs=bounded(jobsArg,1,950),iterations=bounded(iterationsArg,1,100);
const directory=mkdtempSync(join(tmpdir(),'math-q01-bench-'));
const samples=[];
try{
 const q=await openBookQueue({directory});
 const sourceHash='a'.repeat(64);
 for(let i=0;i<jobs;i++)await q.enqueue({sourceHash,edition:'Synthetic benchmark',page:i+1,extractionVersion:'bench-v1',payload:{sample:'x'.repeat(128)}});
 for(let i=0;i<iterations;i++){
  const start=performance.now();
  await q.enqueue({sourceHash,edition:'Synthetic benchmark',page:jobs+i+1,extractionVersion:'bench-v1',payload:{sample:'x'.repeat(128)}});
  samples.push(performance.now()-start);
 }
 const sorted=[...samples].sort((a,b)=>a-b);
 const quantile=p=>sorted[Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1)];
 console.log(JSON.stringify({kind:'synthetic-sqlite-queue-rewrite',jobsBefore:jobs,iterations,platform:process.platform,node:process.version,p50Ms:quantile(.5),p95Ms:quantile(.95),maxMs:sorted.at(-1),note:'Synthetic only; no production or physical acceptance'},null,2));
}finally{rmSync(directory,{recursive:true,force:true});}
