import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngestionWorker} from '../src/ingestion-worker.mjs';
import {spawnSync} from 'node:child_process';
const token='22222222-2222-4222-8222-222222222222';

test('terminal transitions drain every started checkpoint even when the handler returns or a parallel write fails',async()=>{
 for(const failEarly of [false,true]){
  let start,finish;const started=new Promise(r=>{start=r}),pending=new Promise(r=>{finish=r});const events=[];
  const store={claim:async()=>({job_id:1,kind:'verify-candidate',payload:{},claim_token:token}),renew:async()=>{},checkpoint:async({checkpoint})=>{
   if(checkpoint.fail)throw Error('checkpoint rejected');events.push('checkpoint-start');start();await pending;events.push('checkpoint-end');
  },complete:async()=>events.push('complete'),fail:async()=>events.push('fail')};
  const worker=createIngestionWorker({store,workerId:'test',onError:()=>{},handlers:{'verify-candidate':async(_payload,context)=>{
   const saving=context.saveCheckpoint({step:1});
   if(failEarly)await Promise.all([context.saveCheckpoint({fail:true}),saving]);
   return {};
  }}});
  const tick=worker.tick();try{await started;await new Promise(r=>setImmediate(r));assert.deepEqual(events,['checkpoint-start']);}
  finally{finish();await tick;await worker.drain();}
  assert.deepEqual(events,['checkpoint-start','checkpoint-end',failEarly?'fail':'complete']);
 }
});

test('checkpoint callback rejects executable accessors and malformed data before native store calls',async()=>{
 let getters=0,writes=0,completed=false;
 const accessor={};Object.defineProperty(accessor,'source',{enumerable:true,get(){getters++;return 'untrusted'}});
 const store={claim:async()=>({job_id:1,kind:'verify-candidate',payload:{},claim_token:token}),renew:async()=>{},checkpoint:async()=>{writes++},complete:async()=>{completed=true},fail:async()=>{throw Error('unexpected failure')}};
 const worker=createIngestionWorker({store,workerId:'test',handlers:{'verify-candidate':async(_payload,context)=>{
  for(const bad of [accessor,[],null,{text:'x'.repeat(262145)}])await assert.rejects(context.saveCheckpoint(bad));
  assert.equal(getters,0);assert.equal(writes,0);return {};
 }}});
 await worker.tick();assert.equal(getters,0);assert.equal(writes,0);assert.equal(completed,true);
});
test('active heartbeat keeps a standalone worker alive until its awaited handler completes',()=>{
 const moduleURL=new URL('../src/ingestion-worker.mjs',import.meta.url).href;
 const source=`import {createIngestionWorker} from ${JSON.stringify(moduleURL)};
 let release;const heartbeat=new Promise(resolve=>{release=resolve});
 const store={claim:async()=>({job_id:'1',kind:'verify-candidate',payload:{}}),renew:async()=>release(),complete:async()=>process.stdout.write('completed'),fail:async()=>{process.exitCode=1}};
 const worker=createIngestionWorker({store,workerId:'child',heartbeatMs:100,handlers:{'verify-candidate':async()=>{await heartbeat;return {ok:true}}}});
 await worker.tick();`;
 const child=spawnSync(process.execPath,['--input-type=module','--eval',source],{encoding:'utf8',timeout:5000,windowsHide:true});
 assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'completed');
});
test('native pg decimal string IDs are normalized for handler completion failure and heartbeat',async()=>{
 for(const failure of [false,true]){const seen=[],job={job_id:'42',kind:'verify-candidate',payload:{},attempts:1,claim_token:token};let release;const renewed=new Promise(resolve=>{release=resolve});
 const store={claim:async()=>job,renew:async args=>{seen.push(['renew',args]);release()},complete:async args=>seen.push(['complete',args]),fail:async args=>seen.push(['fail',args])};
 const worker=createIngestionWorker({store,workerId:'pg',heartbeatMs:100,handlers:{'verify-candidate':async(_,context)=>{assert.equal(context.jobId,42);await renewed;if(failure)throw Error('expected');return {ok:true}}}});
 await worker.tick();assert.deepEqual(seen.map(([name,args])=>[name,args.jobId,args.claimToken]),[['renew',42,token],[failure?'fail':'complete',42,token]]);
 }
});
test('unsafe or noncanonical claimed IDs never reach a handler or store mutation',async()=>{
 for(const id of ['9007199254740992','0','01','-1','1e2',' 2',0,NaN]){let calls=0;const errors=[];const store={claim:async()=>({job_id:id,kind:'verify-candidate',payload:{}}),renew:async()=>{calls++},complete:async()=>{calls++},fail:async()=>{calls++}};const worker=createIngestionWorker({store,workerId:'pg',handlers:{'verify-candidate':async()=>{calls++;return {}}},onError:error=>errors.push(error)});await worker.tick();assert.equal(calls,0);assert.match(errors[0]?.message??'',/job.*id/i);}
});
test('handler receives detached resumed checkpoint and saves with exact claim token until completion',async()=>{
 const checkpoint={phase:{offset:4}},writes=[];let lateSave;const job={job_id:'9',kind:'verify-candidate',payload:{},checkpoint,claim_token:token};
 const store={claim:async()=>job,renew:async()=>{},checkpoint:async args=>writes.push(args),complete:async()=>{},fail:async()=>{throw Error('unexpected failure')}};
 const worker=createIngestionWorker({store,workerId:'pg',handlers:{'verify-candidate':async(_,context)=>{assert.deepEqual(context.checkpoint,checkpoint);context.checkpoint.phase.offset=5;assert.equal(checkpoint.phase.offset,4);lateSave=context.saveCheckpoint;await context.saveCheckpoint({phase:'verified'});return {ok:true}}}});
 await worker.tick();assert.deepEqual(writes,[{jobId:9,workerId:'pg',claimToken:token,checkpoint:{phase:'verified'}}]);await assert.rejects(lateSave({phase:'late'}),/active|completed|lease/i);assert.equal(writes.length,1);
});
test('checkpoint callback rejects unsupported backend and exposes null when no checkpoint exists',async()=>{
 let completed=false;const store={claim:async()=>({job_id:3,kind:'verify-candidate',payload:{}}),renew:async()=>{},complete:async()=>{completed=true},fail:async()=>{throw Error('unexpected failure')}};const worker=createIngestionWorker({store,workerId:'legacy',handlers:{'verify-candidate':async(_,context)=>{assert.equal(context.checkpoint,null);await assert.rejects(context.saveCheckpoint({}),/support/i);return {ok:true}}}});await worker.tick();assert.equal(completed,true);
});
test('heartbeat loss aborts and disables saved checkpoint callback before handler returns',async()=>{
 let writes=0,checked=false;const errors=[],renewed=[];let lose;const loss=new Promise(resolve=>{lose=resolve});const store={claim:async()=>({job_id:'7',kind:'verify-candidate',payload:{},claim_token:token}),renew:async args=>{renewed.push(args);throw Error('lease rejected')},checkpoint:async()=>{writes++},complete:async()=>{throw Error('must not complete')},fail:async()=>{throw Error('must not fail stale lease')}};
 const worker=createIngestionWorker({store,workerId:'pg',heartbeatMs:100,onError:error=>{errors.push(error);lose()},handlers:{'verify-candidate':async(_,context)=>{await loss;assert.equal(context.signal.aborted,true);await assert.rejects(context.saveCheckpoint({}),/active|lease|abort/i);checked=true;return {ok:true}}}});await worker.tick();assert.equal(checked,true);assert.equal(writes,0);assert.equal(renewed[0].claimToken,token);assert.ok(errors.some(e=>e.message==='lease rejected'));
});
test('worker passes per-claim fencing token to completion',async()=>{
 const calls=[];
 const store={
  async claim(){return calls.length?null:{job_id:4,kind:'verify-candidate',payload:{},attempts:2,claim_token:token}},
  async renew(){throw Error('unexpected heartbeat')},
  async complete(args){calls.push(args)},
  async fail(){throw Error('unexpected fail')}
 };
 const worker=createIngestionWorker({store,workerId:'reused',handlers:{'verify-candidate':async()=>({ok:true})}});
 await worker.tick();
 assert.equal(calls.length,1);
 assert.equal(calls[0].claimToken,token);
});
test('worker passes fencing token on failed handler',async()=>{
 const calls=[];
 const store={
  async claim(){return calls.length?null:{job_id:5,kind:'verify-candidate',payload:{},attempts:1,claim_token:token}},
  async renew(){throw Error('unexpected heartbeat')},
  async complete(){throw Error('unexpected complete')},
  async fail(args){calls.push(args)}
 };
 const worker=createIngestionWorker({store,workerId:'reused',handlers:{'verify-candidate':async()=>{throw Error('handler failed')}},onError:()=>{}});
 await worker.tick();
 assert.equal(calls.length,1);
 assert.equal(calls[0].claimToken,token);
});
