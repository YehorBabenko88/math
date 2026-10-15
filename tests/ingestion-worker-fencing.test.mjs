import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngestionWorker} from '../src/ingestion-worker.mjs';
const token='22222222-2222-4222-8222-222222222222';
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
