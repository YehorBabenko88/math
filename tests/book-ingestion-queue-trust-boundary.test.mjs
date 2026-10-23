import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';

const input={sourceHash:'a'.repeat(64),edition:'Synthetic 2026',page:1,extractionVersion:'ocr-v1',payload:{documentId:'fixture'}};
function directory(t){
 const d=mkdtempSync(join(tmpdir(),'math-trust-boundary-'));
 t.after(()=>rmSync(d,{recursive:true,force:true}));
 return d;
}
test('SQLite queue refuses forged mathematical verification while preserving lease',async t=>{
 const q=await openBookQueue({directory:directory(t)});
 const job=await q.enqueue(input);
 const lease=await q.acquire({workerId:'test',leaseMs:60000});
 await assert.rejects(q.complete(job.id,lease.token,{result:{status:'KERNEL_VERIFIED'},metrics:{}}),/Independent proof kernel verification required/);
 const unchanged=await q.get(job.id);
 assert.equal(unchanged.state,'leased');
 assert.equal(unchanged.result,undefined);
 await q.complete(job.id,lease.token,{result:{status:'LLM_CANDIDATE'},metrics:{}});
 assert.equal((await q.get(job.id)).result.status,'LLM_CANDIDATE');
});
test('snapshot import refuses completed forged verified status atomically',async t=>{
 const sourceDirectory=directory(t);
 const targetDirectory=directory(t);
 const a=await openBookQueue({directory:sourceDirectory});
 const j=await a.enqueue(input);
 const lease=await a.acquire({workerId:'test',leaseMs:60000});
 await a.complete(j.id,lease.token,{result:{status:'LLM_CANDIDATE'},metrics:{}});
 const snapshot=await a.exportSnapshot();
 snapshot.jobs[0].result.status='KERNEL_VERIFIED';
 const b=await openBookQueue({directory:targetDirectory});
 await assert.rejects(b.importSnapshot(snapshot),/Invalid queue state/);
 assert.deepEqual(await b.list(),[]);
});

test('SQLite queue rejects nested forged verification claims',async t=>{
 const q=await openBookQueue({directory:directory(t)});
 const job=await q.enqueue(input);
 const lease=await q.acquire({workerId:'test',leaseMs:60000});
 for(const result of [
  {claims:[{status:'KERNEL_VERIFIED'}]},
  {metadata:{mathematicallyVerified:true}},
  {proof:{verificationStatus:'PROVEN'}}
 ]){
  await assert.rejects(q.complete(job.id,lease.token,{result,metrics:{}}),/Independent proof kernel verification required/);
  assert.equal((await q.get(job.id)).state,'leased');
 }
 await q.complete(job.id,lease.token,{result:{claims:[{status:'LLM_CANDIDATE'}]},metrics:{}});
 assert.equal((await q.get(job.id)).state,'completed');
});
