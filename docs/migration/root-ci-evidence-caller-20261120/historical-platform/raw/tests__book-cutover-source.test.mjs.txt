import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
const input={sourceHash:'a'.repeat(64),edition:'test',page:1,extractionVersion:'1',payload:{}};
test('freeze fences existing SQL writers, persists owner and detects removed guards',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'book-freeze-'));
 try{const q=await openBookQueue({directory,now:()=>100});await q.enqueue(input);const old=new DatabaseSync(join(directory,'queue.sqlite'));
 const {freezeBookSource,assertBookSourceFrozen}=await import('../src/book-ingestion/cutover-source.mjs');
 const a=await freezeBookSource({directory,runId:'run-a'});assert.equal(a.storageWritersFenced,true);assert.equal(a.workerProcessesStopped,false);
 assert.throws(()=>old.exec('DELETE FROM jobs'),/frozen/);assert.throws(()=>old.exec('UPDATE queue_metadata SET version=version'),/frozen/);
 assert.equal((await freezeBookSource({directory,runId:'run-a'})).freezeHash,a.freezeHash);
 await assert.rejects(freezeBookSource({directory,runId:'run-b'}));old.exec('DROP TRIGGER book_cutover_jobs_delete');old.close();await assert.rejects(assertBookSourceFrozen({directory,runId:'run-a'}));
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('freeze allows journal tables and fences an independently opened process',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'book-freeze-child-'));
 try{const q=await openBookQueue({directory,now:()=>100});await q.enqueue(input);const {freezeBookSource,assertBookSourceFrozen}=await import('../src/book-ingestion/cutover-source.mjs');await freezeBookSource({directory,runId:'child'});
 const {spawnSync}=await import('node:child_process');const script=`const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1]);try{d.exec('INSERT INTO queue_metadata VALUES(2,1,3)');process.exitCode=2}catch(e){if(!e.message.includes('frozen'))process.exitCode=3}finally{d.close()}`;assert.equal(spawnSync(process.execPath,['-e',script,join(directory,'queue.sqlite')]).status,0);
 const db=new DatabaseSync(join(directory,'queue.sqlite'));db.exec('CREATE TABLE controller_journal(id INTEGER); INSERT INTO controller_journal VALUES(1)');db.close();
 // Schema changes invalidate the fingerprint, despite unrestricted controller tables.
 await assert.rejects(assertBookSourceFrozen({directory,runId:'child'}));
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('native queue rejects frozen mutations including noops and old lease completion while reads survive expiry',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'book-freeze-api-'));let time=100;
 try{const q=await openBookQueue({directory,now:()=>time});await q.enqueue(input);const lease=await q.acquire({workerId:'old',leaseMs:1});const {freezeBookSource}=await import('../src/book-ingestion/cutover-source.mjs');await freezeBookSource({directory,runId:'api'});
 await assert.rejects(q.enqueue(input),/frozen/);await assert.rejects(q.acquire({workerId:'new',leaseMs:10}),/frozen/);await assert.rejects(q.renew(lease.id,lease.token,{leaseMs:10}),/frozen/);await assert.rejects(q.complete(lease.id,lease.token,{result:{},metrics:{}}),/frozen/);
 time=1000;const reopened=await openBookQueue({directory,now:()=>time});assert.equal((await reopened.get(lease.id)).state,'leased');assert.equal((await reopened.list()).length,1);assert.equal((await reopened.exportSnapshot()).jobs[0].token,lease.token);await assert.rejects(reopened.enqueue(input),/frozen/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
