import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,lstatSync,realpathSync,existsSync,readFileSync,writeFileSync,copyFileSync,mkdtempSync,rmSync,constants} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {assertBookSourceFrozen,checkedBookSourcePath} from './cutover-source.mjs';
import {readBookSnapshot,openBookQueue} from './queue.mjs';
import {createBookQueueAPI} from './queue-contract.mjs';
import {planBookTransfer} from './postgres-transfer.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
function safeDirectory(directory,create=false){const p=resolve(directory);if(create)mkdirSync(p,{recursive:true,mode:0o700});const actual=realpathSync(p),norm=s=>process.platform==='win32'?s.toLowerCase():s;if(norm(actual)!==norm(p)||!lstatSync(p).isDirectory()||p.startsWith('\\\\'))throw Error('Unsafe backup');return p;}
function safeFile(p){const s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>32*1024*1024)throw Error('Unsafe backup');}
function standaloneFile(p){safeFile(p);for(const suffix of ['-wal','-shm','-journal']){try{lstatSync(p+suffix);}catch(error){if(error.code==='ENOENT')continue;throw error;}throw Error('Backup sidecar rejected');}}
function readPhysical(file,maxAttempts){safeFile(file);const db=new DatabaseSync(file,{readOnly:true});try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Invalid backup');return readBookSnapshot(db,maxAttempts);}finally{db.close();}}
async function restoreProof(file,maxAttempts){
 const root=realpathSync(mkdtempSync(join(tmpdir(),'book-cutover-restore-')));
 try{const physical=join(root,'physical');mkdirSync(physical);const copy=join(physical,'queue.sqlite');copyFileSync(file,copy,constants.COPYFILE_EXCL);const snapshot=readPhysical(copy,maxAttempts);
 // A native import is executed independently from the expected contract import,
 // with one deterministic clock. Import always revokes the old worker tokens.
 const clock=Math.max(0,...snapshot.jobs.map(j=>j.updatedAt));const target=await openBookQueue({directory:join(root,'logical'),now:()=>clock,maxAttempts});await target.importSnapshot(snapshot);const restored=await target.exportSnapshot();
 let expected={schemaVersion:1,maxAttempts,jobs:[]};const api=createBookQueueAPI({maxAttempts,transaction:fn=>{const result=fn(expected,clock);return structuredClone(result);}});await api.importSnapshot(snapshot);
 const restoredHash=planBookTransfer({snapshot:restored,maxAttempts}).snapshotHash;if(restoredHash!==planBookTransfer({snapshot:expected,maxAttempts}).snapshotHash)throw Error('Restore mismatch');
 for(const job of snapshot.jobs.filter(j=>j.state==='leased')){await target.acquire({workerId:'restore-proof',leaseMs:1,jobId:job.id});await target.renew(job.id,job.token,{leaseMs:1}).then(()=>{throw Error('Stale token accepted')},error=>{if(error.message!=='Lease rejected')throw error;});}
 return {snapshot,restoredHash,invalidatedLeaseCount:snapshot.jobs.filter(j=>j.state==='leased').length};
 }finally{if(dirname(root)!==realpathSync(tmpdir())||!root.split(/[\\/]/).at(-1).startsWith('book-cutover-restore-'))throw Error('Unsafe restore cleanup');rmSync(root,{recursive:true,force:true});}
}
const fields=['version','runId','sourceId','freezeHash','sourceHash','physicalSHA256','restoredHash','invalidatedLeaseCount'];
function equal(a,b){return fields.every(k=>a?.[k]===b?.[k]);}
export async function verifyBookCutoverBackup({directory,backupDirectory,runId,evidence,maxAttempts=3}){
 try{const before=await assertBookSourceFrozen({directory,runId,maxAttempts}),path=safeDirectory(backupDirectory),file=join(path,'queue.sqlite'),proof=join(path,'proof.json');standaloneFile(file);safeFile(proof);const stored=JSON.parse(readFileSync(proof,'utf8'));const restored=await restoreProof(file,maxAttempts);const actual={version:1,runId,sourceId:before.sourceId,freezeHash:before.freezeHash,sourceHash:before.snapshotHash,physicalSHA256:hash(readFileSync(file)),restoredHash:restored.restoredHash,invalidatedLeaseCount:restored.invalidatedLeaseCount};if(planBookTransfer({snapshot:restored.snapshot,maxAttempts}).snapshotHash!==before.snapshotHash||!equal(stored,actual)||evidence!==undefined&&!equal(evidence,actual))throw Error('Backup proof mismatch');const after=await assertBookSourceFrozen({directory,runId,maxAttempts});if(after.freezeHash!==before.freezeHash)throw Error('Source changed');standaloneFile(file);return {...actual,snapshot:restored.snapshot,storageWritersFenced:true,workerProcessesStopped:false};}catch{throw Error('Book cutover backup verification failed');}
}
export async function createBookCutoverBackup({directory,backupDirectory,runId,maxAttempts=3}){
 let db;try{const source=await assertBookSourceFrozen({directory,runId,maxAttempts}),path=safeDirectory(backupDirectory,true),file=join(path,'queue.sqlite'),proof=join(path,'proof.json');if(existsSync(file)||existsSync(proof)){const verified=await verifyBookCutoverBackup({directory,backupDirectory,runId,maxAttempts});return Object.fromEntries(fields.map(k=>[k,verified[k]]));}
 // VACUUM INTO creates a physical SQLite image and refuses existing files.
 db=new DatabaseSync(join(checkedBookSourcePath(directory),'queue.sqlite'),{readOnly:true});db.prepare('VACUUM INTO ?').run(file);db.close();db=undefined;standaloneFile(file);const restored=await restoreProof(file,maxAttempts);const after=await assertBookSourceFrozen({directory,runId,maxAttempts});if(after.freezeHash!==source.freezeHash||planBookTransfer({snapshot:restored.snapshot,maxAttempts}).snapshotHash!==source.snapshotHash)throw Error('Source changed');const result={version:1,runId,sourceId:source.sourceId,freezeHash:source.freezeHash,sourceHash:source.snapshotHash,physicalSHA256:hash(readFileSync(file)),restoredHash:restored.restoredHash,invalidatedLeaseCount:restored.invalidatedLeaseCount};writeFileSync(proof,JSON.stringify(result),{flag:'wx',mode:0o600});await verifyBookCutoverBackup({directory,backupDirectory,runId,evidence:result,maxAttempts});return result;
 }catch{throw Error('Book cutover backup creation failed');}finally{db?.close();}
}
