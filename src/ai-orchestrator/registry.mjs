// Owner-operated SQLite receipt registry; offline prototype only.
// Atomic UNIQUE(task_id, attempt) rejects duplicates across restarts and processes.
// No executor authentication, proof checking or publication authority.
import {DatabaseSync} from 'node:sqlite';
const id=/^[-a-zA-Z0-9_]{1,80}$/,hex=/^[0-9a-f]{64}$/;
export function openReceiptRegistry(filename){
 if(typeof filename!=='string'||filename.length===0)throw Error('INVALID_DATABASE_PATH');
 const db=new DatabaseSync(filename,{timeout:5000});
 try{
  db.exec(`PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS ai_receipt_registry (
 task_id TEXT NOT NULL,
 attempt INTEGER NOT NULL CHECK(attempt BETWEEN 1 AND 2),
 receipt_hash TEXT NOT NULL CHECK(length(receipt_hash)=64),
 PRIMARY KEY(task_id,attempt)
);`);
  return Object.freeze({
   register({taskId,attempt,receiptHash}={}){
    if(typeof taskId!=='string'||!id.test(taskId)||!Number.isSafeInteger(attempt)||attempt<1||attempt>2||typeof receiptHash!=='string'||!hex.test(receiptHash))throw Error('INVALID_REGISTRATION');
    try{
     db.prepare('INSERT INTO ai_receipt_registry(task_id,attempt,receipt_hash) VALUES(?,?,?)').run(taskId,attempt,receiptHash);
    }catch(e){
     if(e?.code==='ERR_SQLITE_ERROR'&&/UNIQUE constraint failed/.test(e.message))throw Error('REPLAY_DETECTED');
     throw e;
    }
    return Object.freeze({taskId,attempt,status:'REGISTERED_UNATTESTED'});
   },
   close(){db.close();}
  });
 }catch(e){db.close();throw e;}
}
