import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
test('physical backup proves restore, invalidates lease tokens and detects changed bytes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'book-backup-')),directory=join(root,'source'),backupDirectory=join(root,'backup');
 try{const q=await openBookQueue({directory,now:()=>100});await q.enqueue({sourceHash:'a'.repeat(64),edition:'test',page:1,extractionVersion:'1',payload:{}});await q.acquire({workerId:'old',leaseMs:3600000});
 const {freezeBookSource}=await import('../src/book-ingestion/cutover-source.mjs');const {createBookCutoverBackup,verifyBookCutoverBackup}=await import('../src/book-ingestion/cutover-backup.mjs');
 const source=await freezeBookSource({directory,runId:'run-a'}),evidence=await createBookCutoverBackup({directory,backupDirectory,runId:'run-a'});
 assert.equal(evidence.sourceHash,source.snapshotHash);assert.equal(evidence.invalidatedLeaseCount,1);assert.notEqual(evidence.restoredHash,evidence.sourceHash);
 const verified=await verifyBookCutoverBackup({directory,backupDirectory,runId:'run-a',evidence});assert.equal(verified.snapshot.jobs[0].state,'leased');assert.deepEqual(await createBookCutoverBackup({directory,backupDirectory,runId:'run-a'}),evidence);
 appendFileSync(join(backupDirectory,'queue.sqlite'),'corrupt');await assert.rejects(verifyBookCutoverBackup({directory,backupDirectory,runId:'run-a',evidence}));
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('backup rejects an unfinished artifact and preserves frozen source bytes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'book-backup-partial-')),directory=join(root,'source'),backupDirectory=join(root,'backup');
 try{const {mkdirSync,writeFileSync,readFileSync}=await import('node:fs');await openBookQueue({directory,now:()=>100});const {freezeBookSource}=await import('../src/book-ingestion/cutover-source.mjs');const {createBookCutoverBackup}=await import('../src/book-ingestion/cutover-backup.mjs');await freezeBookSource({directory,runId:'partial'});const before=readFileSync(join(directory,'queue.sqlite'));mkdirSync(backupDirectory);writeFileSync(join(backupDirectory,'queue.sqlite'),'unfinished');await assert.rejects(createBookCutoverBackup({directory,backupDirectory,runId:'partial'}));assert.equal(readFileSync(join(backupDirectory,'queue.sqlite'),'utf8'),'unfinished');assert.deepEqual(readFileSync(join(directory,'queue.sqlite')),before);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('physical database corruption fails an actual restore verification',async()=>{
 const root=mkdtempSync(join(tmpdir(),'book-backup-corrupt-')),directory=join(root,'source'),backupDirectory=join(root,'backup');
 try{const {writeFileSync}=await import('node:fs');await openBookQueue({directory,now:()=>100});const {freezeBookSource}=await import('../src/book-ingestion/cutover-source.mjs');const {createBookCutoverBackup,verifyBookCutoverBackup}=await import('../src/book-ingestion/cutover-backup.mjs');await freezeBookSource({directory,runId:'corrupt'});const evidence=await createBookCutoverBackup({directory,backupDirectory,runId:'corrupt'});writeFileSync(join(backupDirectory,'queue.sqlite'),Buffer.alloc(4096));await assert.rejects(verifyBookCutoverBackup({directory,backupDirectory,runId:'corrupt',evidence}),/^Error: Book cutover backup verification failed$/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
