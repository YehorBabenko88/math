import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,linkSync,unlinkSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
import {freezeBookSource,assertBookSourceFrozen} from '../src/book-ingestion/cutover-source.mjs';
import {createBookCutoverBackup,verifyBookCutoverBackup} from '../src/book-ingestion/cutover-backup.mjs';
const input={sourceHash:'a'.repeat(64),edition:'synthetic',page:1,extractionVersion:'v1',payload:{}};
const temp=()=>realpathSync(mkdtempSync(join(tmpdir(),'book-hardening-')));

test('WAL readers cannot upgrade their old snapshot after freeze; backup restores current state',async()=>{
 const root=temp(),directory=join(root,'source'),backupDirectory=join(root,'backup');let reader;
 try{const queue=await openBookQueue({directory,now:()=>1000});await queue.enqueue(input);
 reader=new DatabaseSync(join(directory,'queue.sqlite'));reader.exec('PRAGMA journal_mode=WAL; BEGIN');reader.prepare('SELECT count(*) FROM jobs').get();
 const source=await freezeBookSource({directory,runId:'wal'});
 assert.throws(()=>reader.exec('UPDATE jobs SET updatedAt=updatedAt+1'),/locked|snapshot|frozen/i);
 const proof=await createBookCutoverBackup({directory,backupDirectory,runId:'wal'});assert.equal(proof.sourceHash,source.snapshotHash);
 assert.equal((await verifyBookCutoverBackup({directory,backupDirectory,runId:'wal',evidence:proof})).sourceHash,source.snapshotHash);
 reader.exec('ROLLBACK');assert.throws(()=>reader.exec('DELETE FROM jobs'),/frozen/);
 assert.equal((await queue.list()).length,1);await assert.rejects(queue.enqueue(input),/frozen/);assert.equal(reader.prepare('PRAGMA journal_mode').get().journal_mode,'wal');
 }finally{reader?.close();rmSync(root,{recursive:true,force:true});}
});
test('freeze waits for an in-flight WAL writer and then fences the same old process',{timeout:10000},async()=>{
 const root=temp(),directory=join(root,'source');let child;
 try{const queue=await openBookQueue({directory,now:()=>1000});await queue.enqueue(input);
 const script=`const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec('PRAGMA journal_mode=WAL; BEGIN IMMEDIATE; UPDATE jobs SET updatedAt=updatedAt+1');process.send('locked');setTimeout(()=>{db.exec('COMMIT');process.once('message',()=>{let code=2;try{db.exec('UPDATE jobs SET updatedAt=updatedAt+1')}catch(error){if(error.message.includes('frozen'))code=0}finally{db.close();process.exit(code)}})},150);`;
 child=spawn(process.execPath,['-e',script,join(directory,'queue.sqlite')],{windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});
 const [message]=await once(child,'message');assert.equal(message,'locked');
 const witness=await freezeBookSource({directory,runId:'writer'});assert.equal(witness.snapshot.jobs[0].updatedAt,1001);
 const exit=once(child,'exit');child.send('check');assert.equal((await exit)[0],0);
 assert.equal((await assertBookSourceFrozen({directory,runId:'writer'})).snapshotHash,witness.snapshotHash);
 }finally{if(child?.exitCode===null)child.kill();rmSync(root,{recursive:true,force:true});}
});
test('backup rejects static hardlinks and a redirected backup directory',async()=>{
 const root=temp(),directory=join(root,'source'),backupDirectory=join(root,'backup');
 try{await openBookQueue({directory});await freezeBookSource({directory,runId:'paths'});const evidence=await createBookCutoverBackup({directory,backupDirectory,runId:'paths'});
 for(const name of ['queue.sqlite','proof.json']){const alias=join(root,'alias');linkSync(join(backupDirectory,name),alias);try{await assert.rejects(verifyBookCutoverBackup({directory,backupDirectory,runId:'paths',evidence}));}finally{unlinkSync(alias);}}
 const redirected=join(root,'redirected');symlinkSync(backupDirectory,redirected,process.platform==='win32'?'junction':'dir');
 await assert.rejects(verifyBookCutoverBackup({directory,backupDirectory:redirected,runId:'paths',evidence}));
 assert.equal((await verifyBookCutoverBackup({directory,backupDirectory,runId:'paths',evidence})).physicalSHA256,evidence.physicalSHA256);
 }finally{rmSync(root,{recursive:true,force:true});}
});
