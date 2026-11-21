import {resolve,join} from 'node:path';
import {realpathSync} from 'node:fs';
import {canonicalJSON,sha256} from './json.mjs';
import {openCutoverJournal} from './cutover-journal.mjs';
import {freezeBookSource,assertBookSourceFrozen} from './cutover-source.mjs';
import {createBookCutoverBackup,verifyBookCutoverBackup} from './cutover-backup.mjs';
import {fenceBookPostgres,assertBookPostgresFence} from './cutover-postgres.mjs';
import {applyBookTransfer,verifyBookTransfer} from './postgres-transfer.mjs';

export const BOOK_CUTOVER_PRODUCTION_BLOCKERS=Object.freeze(['trusted-operator-provisioning','worker-process-attestation','database-role-isolation','production-routing-not-integrated']);
// Explicit operator API only: importing this module never freezes or switches a backend.
export function openBookCutoverController({directory,backupRoot,pool,runId,resourceId,verifier,now=Date.now,leaseMs=30000,maxAttempts=3,mode='rehearsal'}={}){
 if(mode!=='rehearsal')throw Error('Only isolated rehearsal is supported; production gate closed');
 if(!verifier||typeof verifier.verify!=='function'||!pool||typeof pool.connect!=='function'||typeof directory!=='string'||typeof backupRoot!=='string'||!/^[a-f0-9]{64}$/.test(resourceId??'')||!/^[a-f0-9-]{36}$/.test(runId??''))throw Error('Invalid cutover configuration');
 directory=realpathSync(directory);backupRoot=resolve(backupRoot);
 const backupDirectory=join(backupRoot,runId);
 const configHash=sha256(canonicalJSON({directory,backupRoot,runId,resourceId,maxAttempts,mode}));
 const journal=openCutoverJournal({directory,runId,configHash,now,leaseMs});
 const authorize=(session,scope)=>verifier.verify(session,{runId,resourceId,scope});
 const source=()=>assertBookSourceFrozen({directory,runId,maxAttempts});
 const backup=evidence=>verifyBookCutoverBackup({directory,backupDirectory,runId,evidence,maxAttempts});
 async function guarded(claim){const s=await source();return fenceBookPostgres({pool,runId,sourceId:s.sourceId,generation:claim.generation,maxAttempts});}
 async function verifyAll(evidence,guard){
  const s=await source();if(s.snapshotHash!==evidence.backup.sourceHash||s.freezeHash!==evidence.backup.freezeHash)throw Error('Source changed');
  await backup(evidence.backup);
  const target=await verifyBookTransfer({pool:guard.pool,snapshotHash:s.snapshotHash,maxAttempts,now});
  if(!target.verified||target.activated||evidence.verification&&target.targetHeadHash!==evidence.verification.targetHeadHash)throw Error('Target changed');
  await assertBookPostgresFence({pool,runId,sourceId:s.sourceId,generation:guard.witness.generation});
  return target;
 }
 return Object.freeze({
  status:()=>journal.status(),
  close:()=>journal.close(),
  prepare({session}={}){return journal.prepare(authorize(session,'prepare'));},
  async advance({session}={}){
   const current=journal.status();
   if(!current)throw Error('Cutover not prepared');
   const scopes={PREPARE:'quiesce',QUIESCE:'backup',BACKUP:'transfer',TRANSFER:'verify',VERIFY:'verify',READY:'activate',ACTIVATED:'activate'};
   let scope=scopes[current.state];if(!scope)throw Error('Cutover failed closed');
   const proof=authorize(session,scope);
   if(current.state==='ACTIVATED')return current; // Rehearsal record only, no backend was activated.
   const claim=journal.claim(proof,{expectedState:current.state});let next,evidence={};
   try{
    scope=scopes[claim.state];authorize(session,scope);
    if(claim.state==='PREPARE'){
     const s=await freezeBookSource({directory,runId,maxAttempts});
     const guard=await guarded(claim);evidence={source:{sourceId:s.sourceId,snapshotHash:s.snapshotHash,freezeHash:s.freezeHash,storageWritersFenced:true,workerProcessesStopped:false},target:guard.witness};next='QUIESCE';
    }else{
     const guard=await guarded(claim);
     if(claim.evidence.target&&guard.witness.targetId!==claim.evidence.target.targetId)throw Error('Target identity changed');
     evidence.target=guard.witness;
     if(claim.state==='QUIESCE'){evidence.backup=await createBookCutoverBackup({directory,backupDirectory,runId,maxAttempts});next='BACKUP';}
     else if(claim.state==='BACKUP'){
      const restored=await backup(claim.evidence.backup);
      await applyBookTransfer({pool:guard.pool,snapshot:restored.snapshot,expectedHash:claim.evidence.backup.sourceHash,maxAttempts,now});next='TRANSFER';
     }else{
      evidence.verification=await verifyAll(claim.evidence,guard);
      if(claim.state==='TRANSFER')next='VERIFY';
      else if(claim.state==='VERIFY'){next='READY';evidence.readiness={rehearsalReady:true,productionReady:false,blockers:[...BOOK_CUTOVER_PRODUCTION_BLOCKERS]};}
      else if(claim.state==='READY'){next='ACTIVATED';evidence.activation={simulated:true,backendSwitched:false,sourceStillFenced:true,targetStillFenced:true};}
      else throw Error('Invalid cutover state');
     }
    }
    // Session expiry and ownership are checked again after every asynchronous side effect.
    return journal.commit(claim,next,evidence,authorize(session,scope));
   }catch{
    try{journal.fail(claim,proof);}catch{} // A stale owner must never fail a successor's run.
    throw Error('Book cutover step failed closed');
   }
  }
 });
}
