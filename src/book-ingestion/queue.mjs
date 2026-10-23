import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,lstatSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';

import {json,state,recover,assert,integer,createBookQueueAPI} from './queue-contract.mjs';
import {encodeSQLiteText,decodeSQLiteText} from './sqlite-text.mjs';
const FIELDS=['id','sourceHash','edition','page','extractionVersion','payload','state','attempts','token','leaseUntil','workerId','createdAt','updatedAt','checkpoint','result','metrics','errorCode'];
const JSON_FIELDS=['payload','checkpoint','result','metrics'];
const OPTIONAL=['token','leaseUntil','workerId','checkpoint','result','metrics','errorCode'];
const MAX_BYTES=8*1024*1024;
const LOSSLESS_TEXT=['edition','extractionVersion','workerId'];
function safePath(directory){
 assert(typeof directory==='string'&&directory.length>0);
 const path=resolve(directory);mkdirSync(path,{recursive:true,mode:0o700});
 assert(lstatSync(path).isDirectory()&&!lstatSync(path).isSymbolicLink(),'Queue directory must be local and nonsymlink');
 // realpath also rejects indirect symlink/junction parents. Windows drive case
 // alone may differ, so compare normalized casing on that platform.
 const actual=realpathSync(path),normalize=s=>process.platform==='win32'?s.toLowerCase():s;
 assert(normalize(actual)===normalize(path),'Queue directory must be local and nonsymlink');
 assert(!path.startsWith('\\\\'),'Queue directory must be local and nonsymlink');
 return path;
}
function checkFiles(directory){
 for(const name of ['queue.sqlite','queue.sqlite-journal','queue.sqlite-wal','queue.sqlite-shm']){
  try{const s=lstatSync(join(directory,name));assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'Unsafe queue storage');assert(s.size<=32*1024*1024,'Invalid queue state');}catch(e){if(e.code!=='ENOENT')throw e;}
 }
}
export function readBookSnapshot(db,maxAttempts){
 assert(db.prepare('SELECT count(*) AS n FROM queue_metadata').get().n===1,'Invalid queue state');
 const meta=db.prepare('SELECT version,maxAttempts FROM queue_metadata WHERE singleton=1').get();assert(meta?.version===1&&meta.maxAttempts===maxAttempts,'Invalid queue state');
 const jobs=db.prepare('SELECT * FROM jobs ORDER BY createdAt,id').all().map(row=>{
  const j={};for(const field of FIELDS){if(row[field]===null&&OPTIONAL.includes(field))continue;j[field]=JSON_FIELDS.includes(field)?JSON.parse(row[field]):LOSSLESS_TEXT.includes(field)?decodeSQLiteText(row[field]):row[field];}return j;
 });
 return state({schemaVersion:1,maxAttempts,jobs},maxAttempts);
}
function save(db,document){
 db.exec('DELETE FROM jobs');
 const insert=db.prepare(`INSERT INTO jobs (${FIELDS.join(',')}) VALUES (${FIELDS.map(()=>'?').join(',')})`);
 for(const job of document.jobs)insert.run(...FIELDS.map(field=>job[field]===undefined?null:JSON_FIELDS.includes(field)?JSON.stringify(job[field]):LOSSLESS_TEXT.includes(field)?encodeSQLiteText(job[field]):job[field]));
}
export async function openBookQueue(options={}){
 assert(options&&typeof options==='object'&&Object.getPrototypeOf(options)===Object.prototype);
 const descriptors=Object.getOwnPropertyDescriptors(options);
 assert(Reflect.ownKeys(descriptors).every(k=>['directory','now','maxAttempts'].includes(k)&&Object.hasOwn(descriptors[k],'value')));
 const {directory,now=Date.now,maxAttempts=3}=options;
 assert(typeof now==='function'&&integer(maxAttempts,1,10));let path;
 try{path=safePath(directory);checkFiles(path);}catch{throw Error('Invalid queue directory');}
 function clock(){const n=now();assert(integer(n,0,Number.MAX_SAFE_INTEGER-86400000),'Invalid queue clock');return n;}
 function transaction(fn,{initialize=false,readOnly=false}={}){
  let db;
  try{
   checkFiles(path);let exists=true,existingSize;try{existingSize=lstatSync(join(path,'queue.sqlite')).size;}catch(e){if(e.code==='ENOENT')exists=false;else throw e;}
   db=new DatabaseSync(join(path,'queue.sqlite'));
   // Existing files may be WAL databases with live readers. Reconfiguring their
   // journal mode is a persistent write, including on a frozen read/reopen.
   db.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; BEGIN IMMEDIATE');
   if(initialize&&!exists){
    db.exec(`CREATE TABLE IF NOT EXISTS queue_metadata(singleton INTEGER PRIMARY KEY CHECK(singleton=1),version INTEGER NOT NULL,maxAttempts INTEGER NOT NULL);
     CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, sourceHash TEXT NOT NULL,edition TEXT NOT NULL,page INTEGER NOT NULL,extractionVersion TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL,token TEXT,leaseUntil INTEGER,workerId TEXT,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL,checkpoint TEXT,result TEXT,metrics TEXT,errorCode TEXT);
     CREATE INDEX IF NOT EXISTS jobs_state_lease ON jobs(state,leaseUntil);`);
    const meta=db.prepare('SELECT count(*) AS n FROM queue_metadata').get();if(meta.n===0)db.prepare('INSERT INTO queue_metadata VALUES (1,1,?)').run(maxAttempts);
   }
   // Another creator may have opened the file but not acquired the schema lock
   // yet. Release our transaction and wait; never initialize an existing orphan
   // or repair missing metadata ourselves.
   if(initialize&&exists&&db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='queue_metadata'").get().n===0)throw Object.assign(Error('Invalid queue state'),{code:'BOOK_QUEUE_INITIALIZING'});
   // The durable control table also fences no-op API mutations, which SQLite
   // row triggers cannot observe. Initialization of a frozen store only reads;
   // expired leases remain intact for the explicit restore path to invalidate.
   const frozen=db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='book_cutover_control'").get().n!==0;
   if(frozen&&!readOnly&&!initialize)throw Error('Book source frozen');
   const document=readBookSnapshot(db,maxAttempts),before=JSON.stringify(document),time=clock();const result=frozen&&initialize?undefined:fn(document,time);state(document,maxAttempts);if(JSON.stringify(document)!==before)save(db,document);db.exec('COMMIT');return result===undefined?undefined:json(result,MAX_BYTES);
  }catch(e){if(db){try{db.exec('ROLLBACK')}catch{}}// Never include SQL, paths, payloads or parser errors.
   if(initialize&&e.code==='BOOK_QUEUE_INITIALIZING')throw e;
   if(['Invalid queue input','Invalid queue state','Invalid queue clock','Lease rejected','Queue is not empty','Queue capacity reached','Book source frozen'].includes(e.message))throw e;
   throw Error('Invalid queue state');
  }finally{db?.close();}
 }
 const initializationDeadline=performance.now()+5000;
 for(;;){
  try{transaction((d,time)=>recover(d.jobs,time,maxAttempts),{initialize:true});break}
  catch(error){
   if(error.code!=='BOOK_QUEUE_INITIALIZING')throw error;
   if(performance.now()>=initializationDeadline)throw Error('Invalid queue state');
   await new Promise(resolve=>setTimeout(resolve,10));
  }
 }
 const api=createBookQueueAPI({transaction,maxAttempts});
 const reads=createBookQueueAPI({transaction:fn=>transaction(fn,{readOnly:true}),maxAttempts});
 for(const method of ['get','list','exportSnapshot'])api[method]=reads[method];
 return api;
}
