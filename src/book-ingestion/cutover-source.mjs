import {DatabaseSync} from 'node:sqlite';
import {lstatSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {readBookSnapshot} from './queue.mjs';
import {planBookTransfer} from './postgres-transfer.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const guards=['jobs','queue_metadata'].flatMap(table=>['insert','update','delete'].map(op=>({name:`book_cutover_${table}_${op}`,sql:`CREATE TRIGGER book_cutover_${table}_${op} BEFORE ${op.toUpperCase()} ON ${table} WHEN (SELECT activeRun FROM book_cutover_control WHERE singleton=1) IS NOT NULL BEGIN SELECT RAISE(ABORT, 'Book source frozen'); END`})));
export function checkedBookSourcePath(directory){
 const path=resolve(directory),actual=realpathSync(path),norm=s=>process.platform==='win32'?s.toLowerCase():s;
 if(norm(path)!==norm(actual)||path.startsWith('\\\\')||!lstatSync(path).isDirectory())throw Error('Invalid cutover source');
 for(const name of ['queue.sqlite','queue.sqlite-journal','queue.sqlite-wal','queue.sqlite-shm']){try{const s=lstatSync(join(path,name));if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw Error('Invalid cutover source');}catch(e){if(e.code!=='ENOENT'||name==='queue.sqlite')throw e;}}
 return actual;
}
function fingerprint(db){
 const rows=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') ORDER BY type,name").all();
 for(const g of guards)if(rows.find(x=>x.name===g.name)?.sql!==g.sql)throw Error('Invalid freeze guards');
 return hash(JSON.stringify(rows));
}
function witness(db,path,runId,maxAttempts){
 if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Invalid source integrity');
 const row=db.prepare('SELECT * FROM book_cutover_control WHERE singleton=1').get();if(row?.activeRun!==runId)throw Error('Source freeze ownership rejected');
 const schemaHash=fingerprint(db),snapshot=readBookSnapshot(db,maxAttempts),snapshotHash=planBookTransfer({snapshot,maxAttempts}).snapshotHash;
 const sourceId=hash(JSON.stringify([path,1])),freezeHash=hash(JSON.stringify([sourceId,runId,schemaHash,snapshotHash]));
 if(row.freezeHash!==freezeHash)throw Error('Source freeze changed');
 return {sourceId,snapshotHash,snapshot,freezeHash,storageWritersFenced:true,workerProcessesStopped:false,activeLeases:snapshot.jobs.filter(j=>j.state==='leased').length};
}
function validateRun(runId){if(typeof runId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(runId))throw Error('Invalid cutover run');}
export async function freezeBookSource({directory,runId,maxAttempts=3}){
 let db;try{validateRun(runId);const path=checkedBookSourcePath(directory);db=new DatabaseSync(join(path,'queue.sqlite'));db.exec('PRAGMA busy_timeout=5000; BEGIN EXCLUSIVE');
 db.exec('CREATE TABLE IF NOT EXISTS book_cutover_control(singleton INTEGER PRIMARY KEY CHECK(singleton=1),activeRun TEXT NOT NULL,freezeHash TEXT NOT NULL)');
 const old=db.prepare('SELECT * FROM book_cutover_control WHERE singleton=1').get();
 if(!old){readBookSnapshot(db,maxAttempts);for(const g of guards)db.exec(g.sql);db.prepare('INSERT INTO book_cutover_control VALUES(1,?,?)').run(runId,'pending');const schemaHash=fingerprint(db),snapshotHash=planBookTransfer({snapshot:readBookSnapshot(db,maxAttempts),maxAttempts}).snapshotHash,sourceId=hash(JSON.stringify([path,1]));db.prepare('UPDATE book_cutover_control SET freezeHash=? WHERE singleton=1').run(hash(JSON.stringify([sourceId,runId,schemaHash,snapshotHash])));}
 const result=witness(db,path,runId,maxAttempts);db.exec('COMMIT');return result;
 }catch{try{db?.exec('ROLLBACK')}catch{}throw Error('Book source freeze rejected');}finally{db?.close();}
}
export async function assertBookSourceFrozen({directory,runId,maxAttempts=3}){
 let db;try{validateRun(runId);const path=checkedBookSourcePath(directory);db=new DatabaseSync(join(path,'queue.sqlite'),{readOnly:true});db.exec('PRAGMA busy_timeout=5000; BEGIN');const result=witness(db,path,runId,maxAttempts);db.exec('COMMIT');return result;}catch{throw Error('Book source freeze verification failed');}finally{db?.close();}
}
