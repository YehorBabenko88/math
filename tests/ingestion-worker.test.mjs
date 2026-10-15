import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngestionWorker} from '../src/ingestion-worker.mjs';
test('worker dispatches only registered handlers and stores results',async()=>{
 const jobs=[{job_id:1,kind:'verify-candidate',payload:{formula:'x'},attempts:1}];
 const completed=[];
 const store={async claim(){return jobs.shift()??null},async complete(x){completed.push(x)},async fail(){throw Error('unexpected fail')}};
 const worker=createIngestionWorker({store,workerId:'local',handlers:{'verify-candidate':async input=>({checked:input.formula})}});
 await worker.tick();
 assert.deepEqual(completed,[{jobId:1,workerId:'local',result:{checked:'x'}}]);
 worker.stop();assert.equal(worker.status().stopped,true);
});
test('worker fails jobs with unregistered kind and does not execute payload',async()=>{
 let failed=0,executed=false;
 const store={async claim(){return {job_id:2,kind:'execute-shell',payload:{command:'whoami'},attempts:1}},async complete(){executed=true},async fail(){failed++}};
 const worker=createIngestionWorker({store,workerId:'local',handlers:{}});
 await worker.tick();assert.equal(failed,1);assert.equal(executed,false);
});
test('worker rejects unsafe concurrency and handlers',()=>{
 const store={claim(){},complete(){},fail(){}};
 assert.throws(()=>createIngestionWorker({store,workerId:'x',handlers:{},concurrency:20}),/Invalid concurrency/);
 assert.throws(()=>createIngestionWorker({store,workerId:'x',handlers:{'execute-shell':()=>{}}}),/Invalid job handler/);
});
