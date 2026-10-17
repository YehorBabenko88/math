import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBookSnapshot,createBookQueueAPI} from '../src/book-ingestion/queue-contract.mjs';
test('shared Book contract validates identity and exposes complete native API',async()=>{
 const d={schemaVersion:1,maxAttempts:3,jobs:[]};
 const q=createBookQueueAPI({maxAttempts:3,transaction:fn=>Promise.resolve(fn(d,100))});
 for(const method of ['enqueue','acquire','renew','checkpoint','complete','fail','recordReview','get','list','exportSnapshot','importSnapshot'])assert.equal(typeof q[method],'function');
 const j=await q.enqueue({sourceHash:'a'.repeat(64),edition:'synthetic',page:1,extractionVersion:'1',payload:{allowExternalProcessing:false}});
 assert.deepEqual(validateBookSnapshot(d,3),d);
 assert.throws(()=>validateBookSnapshot({...d,jobs:[{...j,id:'b'.repeat(64)}]},3));
});
test('shared Book JSON rejects proxy traps before executing them',async()=>{
 let calls=0;const payload=new Proxy({},{getPrototypeOf(){calls++;return Object.prototype},ownKeys(){calls++;return []}});
 const d={schemaVersion:1,maxAttempts:3,jobs:[]};const q=createBookQueueAPI({maxAttempts:3,transaction:fn=>Promise.resolve(fn(d,100))});
 await assert.rejects(q.enqueue({sourceHash:'a'.repeat(64),edition:'synthetic',page:1,extractionVersion:'1',payload}));
 assert.equal(calls,0);assert.deepEqual(d.jobs,[]);
});
