import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngestionWorker} from '../src/ingestion-worker.mjs';
test('heartbeat renews lease during long work',async()=>{
 let renewals=0,completed=0,claimed=false;
 const store={
  async claim(){if(claimed)return null;claimed=true;return {job_id:1,kind:'verify-candidate',payload:{},attempts:1}},
  async renew(){renewals++},
  async complete(){completed++},
  async fail(){throw Error('unexpected failure')}
 };
 const worker=createIngestionWorker({store,workerId:'local',heartbeatMs:100,leaseSeconds:10,handlers:{'verify-candidate':async()=>{await new Promise(resolve=>setTimeout(resolve,240));return {ok:true}}}});
 await worker.tick();
 assert.ok(renewals>=1);
 assert.equal(completed,1);
});
test('lost lease prevents successful completion and aborts handler signal',async()=>{
 let completed=0,failed=0,aborted=false;
 const store={
  async claim(){return {job_id:2,kind:'verify-candidate',payload:{},attempts:1}},
  async renew(){throw Error('database unavailable')},
  async complete(){completed++},
  async fail(){failed++}
 };
 const worker=createIngestionWorker({store,workerId:'local',heartbeatMs:100,leaseSeconds:10,onError:()=>{},handlers:{'verify-candidate':async(_payload,{signal})=>{await new Promise(resolve=>setTimeout(resolve,220));aborted=signal.aborted;return {ok:true}}}});
 await worker.tick();
 assert.equal(completed,0);assert.equal(failed,0);assert.equal(aborted,true);
});
