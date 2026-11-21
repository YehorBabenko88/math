import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
import {normalizeSqliteBookLease,normalizePostgresIngestionLease} from '../src/ingestion-lease-contract.mjs';
const pg={job_id:'9007199254740993',worker_id:'worker',attempts:2,lease_until:new Date('2026-10-16T12:00:00.000Z'),claim_token:'11111111-1111-4111-8111-111111111111',payload:{source:{hash:'a'.repeat(64),edition:'Original',version:'v1'},page:7},checkpoint:{step:1}};

test('normalizes a real SQLite acquisition without losing provenance or checkpoint',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'lease-contract-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const q=await openBookQueue({directory,now:()=>100});await q.enqueue({sourceHash:'a'.repeat(64),edition:'Edition',page:7,extractionVersion:'v1',payload:{book:{version:'source-v2',license:'CC0',scope:{pages:[7]}}}});
 const job=await q.acquire({workerId:'worker',leaseMs:100});await q.checkpoint(job.id,job.token,{page:7});const saved=await q.get(job.id),lease=normalizeSqliteBookLease(saved);
 assert.equal(lease.schemaVersion,'mu-job-lease/v1');assert.equal(lease.jobId,'book-sqlite:'+job.id);assert.equal(lease.nativeJobId,job.id);assert.equal(lease.claim_token,job.token);assert.equal(lease.leaseUntilMs,200);assert.equal(lease.attempt,1);assert.equal(lease.workerId,'worker');
 assert.deepEqual(lease.provenance,{sourceHash:'a'.repeat(64),edition:'Edition',page:7,extractionVersion:'v1'});assert.deepEqual(lease.payload,saved.payload);assert.deepEqual(lease.checkpoint,{page:7});assert.ok(Object.isFrozen(lease.payload.book));
 for(const patch of [{sourceHash:'b'.repeat(64)},{edition:'Other'},{page:8},{extractionVersion:'v2'},{token:''},{workerId:''}])assert.throws(()=>normalizeSqliteBookLease({...saved,...patch}),/Invalid/);
 saved.payload.book.version='mutated';assert.equal(lease.payload.book.version,'source-v2');
 await q.complete(job.id,job.token,{result:{},metrics:{}});const completed=await q.get(job.id);assert.throws(()=>normalizeSqliteBookLease(completed),/Invalid/);
});

test('normalizes PostgreSQL bigint strings and timestamps without fabricating source metadata',()=>{
 const lease=normalizePostgresIngestionLease(pg);assert.equal(lease.jobId,'postgres-ingestion:9007199254740993');assert.equal(lease.nativeJobId,pg.job_id);assert.equal(lease.claim_token,pg.claim_token);assert.equal(lease.leaseUntilMs,Date.parse('2026-10-16T12:00:00.000Z'));assert.equal(lease.workerId,'worker');assert.equal(lease.attempt,2);assert.deepEqual(lease.payload,pg.payload);assert.deepEqual(lease.checkpoint,pg.checkpoint);assert.equal(lease.provenance,null);
 const empty=normalizePostgresIngestionLease({...pg,job_id:42,lease_until:'2026-10-16T12:00:00.000Z',checkpoint:null});assert.equal(empty.nativeJobId,'42');assert.equal(empty.checkpoint,null);
});

test('rejects unfenced, malformed, unsafe integer and accessor claims without executing getters',()=>{
 for(const patch of [{claim_token:null},{worker_id:''},{attempts:0},{job_id:9007199254740992},{job_id:'01'},{job_id:'9223372036854775808'},{lease_until:new Date(NaN)},{lease_until:'tomorrow'},{lease_until:'2026-02-30T12:00:00.000Z'},{payload:[]},{checkpoint:[]}])assert.throws(()=>normalizePostgresIngestionLease({...pg,...patch}),/Invalid/);
 let called=false;const malicious={...pg};Object.defineProperty(malicious,'claim_token',{get(){called=true;throw Error('private')}});assert.throws(()=>normalizePostgresIngestionLease(malicious),/Invalid/);assert.equal(called,false);
});

test('normalization rejects sparse arrays disguised with non-index numeric properties',()=>{
 const values=[1];values.length=2;values[4294967295]='extra';
 assert.throws(()=>normalizePostgresIngestionLease({...pg,payload:{values}}),/Invalid/);
 assert.throws(()=>normalizePostgresIngestionLease({...pg,checkpoint:{values}}),/Invalid/);
});
