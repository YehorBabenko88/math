import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,lstatSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {json} from './queue-contract.mjs';
import {canonicalJSON,sha256,freezeJson} from './json.mjs';
const states=['PREPARE','QUIESCE','BACKUP','TRANSFER','VERIFY','READY','ACTIVATED'];
const reject=()=>{throw Error('CUTOVER_JOURNAL_REJECTED');};
const check=x=>{if(!x)reject();};
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function data(value){return json(value,262144);}
export function openCutoverJournal({directory,runId,configHash,now=Date.now,leaseMs=30000}){
 check(typeof directory==='string'&&directory.length>0&&!directory.startsWith('\\\\')&&typeof runId==='string'&&/^[a-f0-9-]{36}$/i.test(runId)&&hash(configHash)&&typeof now==='function'&&Number.isSafeInteger(leaseMs)&&leaseMs>0&&leaseMs<=300000);
 const path=resolve(directory);mkdirSync(path,{recursive:true,mode:0o700});
 check(lstatSync(path).isDirectory()&&!lstatSync(path).isSymbolicLink());const normalize=x=>process.platform==='win32'?x.toLowerCase():x;check(normalize(realpathSync(path))===normalize(path));
 const file=join(path,'cutover.sqlite');for(const suffix of ['','-wal','-shm','-journal']){try{const s=lstatSync(file+suffix);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=32*1024*1024);}catch(error){if(error.code!=='ENOENT')throw error;}}
 const db=new DatabaseSync(file);let closed=false;
 db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS cutover_events(sequence INTEGER PRIMARY KEY,previousHash TEXT NOT NULL,hash TEXT NOT NULL,payload TEXT NOT NULL)');
 const clock=()=>{const time=now();check(Number.isSafeInteger(time)&&time>=0);return time;};
 function read(){
  const rows=db.prepare('SELECT * FROM cutover_events ORDER BY sequence').all();check(rows.length<=100000);let previous='0'.repeat(64),snapshot=null;
  for(let i=0;i<rows.length;i++){const row=rows[i];check(row.sequence===i+1&&row.previousHash===previous&&hash(row.hash));let event;try{event=data(JSON.parse(row.payload));}catch{reject();}check(canonicalJSON(event)===row.payload&&sha256(canonicalJSON({sequence:row.sequence,previousHash:previous,payload:event}))===row.hash);check(event.runId===runId&&event.configHash===configHash&&event.sequence===row.sequence&&event.snapshot&&[...states,'FAILED'].includes(event.snapshot.state)&&Number.isSafeInteger(event.snapshot.generation)&&event.snapshot.generation>=0);snapshot=event.snapshot;previous=row.hash;}
  return {snapshot,previous,sequence:rows.length};
 }
 function append(current,snapshot,code,proof){const sequence=current.sequence+1,payload={sequence,runId,configHash,code,time:clock(),actorHash:proof.actorHash,sessionHash:proof.sessionHash,snapshot};const encoded=canonicalJSON(payload),digest=sha256(canonicalJSON({sequence,previousHash:current.previous,payload}));db.prepare('INSERT INTO cutover_events VALUES(?,?,?,?)').run(sequence,current.previous,digest,encoded);return snapshot;}
 function transact(fn){check(!closed);db.exec('BEGIN IMMEDIATE');try{const result=fn(read());db.exec('COMMIT');return result;}catch{db.exec('ROLLBACK');reject();}}
 function proofOf(value){const p=data(value);check(p&&Object.keys(p).length===3&&hash(p.actorHash)&&hash(p.sessionHash)&&Number.isSafeInteger(p.expiresAt)&&p.expiresAt>clock());return p;}
 function visible(s){return s?freezeJson({runId,configHash,state:s.state,generation:s.generation,evidence:data(s.evidence)}):null;}
 function owned(current,input,proof){const p=proofOf(proof),claim=data(input),s=current.snapshot;check(s&&claim&&typeof claim.token==='string'&&/^[a-f0-9]{64}$/.test(claim.token)&&s.tokenHash===sha256(claim.token)&&s.generation===claim.generation&&s.state===claim.state&&s.leaseUntil>clock()&&s.actorHash===p.actorHash);return {s,p};}
 try{read();}catch(error){db.close();throw error;}
 return Object.freeze({
  prepare(proof){return transact(current=>{const p=proofOf(proof);return visible(current.snapshot??append(current,{state:'PREPARE',generation:0,evidence:{},tokenHash:null,leaseUntil:0,actorHash:null},'PREPARED',p));});},
  status(){check(!closed);return visible(read().snapshot);},
  claim(proof){return transact(current=>{const p=proofOf(proof),s=current.snapshot;check(s&&states.includes(s.state)&&s.state!=='ACTIVATED'&&s.leaseUntil<=clock());const token=randomBytes(32).toString('hex'),snapshot={...s,generation:s.generation+1,tokenHash:sha256(token),leaseUntil:clock()+leaseMs,actorHash:p.actorHash};check(Number.isSafeInteger(snapshot.generation)&&Number.isSafeInteger(snapshot.leaseUntil));append(current,snapshot,'CLAIMED',p);return freezeJson({...visible(snapshot),token});});},
  commit(claim,state,evidence,proof){return transact(current=>{const {s,p}=owned(current,claim,proof);check(states[states.indexOf(s.state)+1]===state);const extra=data(evidence);check(extra&&typeof extra==='object'&&!Array.isArray(extra));return visible(append(current,{...s,state,evidence:{...s.evidence,...extra},tokenHash:null,leaseUntil:0,actorHash:null},'COMMITTED',p));});},
  fail(claim,proof){return transact(current=>{const {s,p}=owned(current,claim,proof);return visible(append(current,{...s,state:'FAILED',tokenHash:null,leaseUntil:0,actorHash:null},'FAILED',p));});},
  close(){if(!closed){db.close();closed=true;}}
 });
}
