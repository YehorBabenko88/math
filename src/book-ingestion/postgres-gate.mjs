import {verifyBookTransfer,activateBookTransfer} from './postgres-transfer.mjs';
import {BOOK_POSTGRES_BLOCKERS} from './postgres-json.mjs';
// This is a trusted operator boundary, not authentication. The caller must authenticate
// the operator and prevent concurrent SQLite intake before using compatible=true.
export async function assessBookPostgresGate({pool,snapshotHash,operatorConfirmation,maxAttempts=3,now}={}){
 if(BOOK_POSTGRES_BLOCKERS.length)return {compatible:false,fullBookstoreSubstitution:false,reason:'Book PostgreSQL contract blockers',blockers:[...BOOK_POSTGRES_BLOCKERS]};
 if(!pool||typeof snapshotHash!=='string')return {compatible:false,reason:'Verified migration required'};
 try{const evidence=await verifyBookTransfer({pool,snapshotHash,maxAttempts,now});
  const expected=`SOURCE SQLITE QUIESCED; ACTIVATE BOOK POSTGRES ${evidence.snapshotHash} ${evidence.targetHash} ${evidence.targetHeadHash}`;
  if(!evidence.verified||operatorConfirmation!==expected)return {compatible:false,reason:'Bound operator confirmation required',evidence};
  const activated=await activateBookTransfer({pool,snapshotHash,operatorConfirmation,maxAttempts,now});return {compatible:activated,evidence:{...evidence,activated}};
 }catch{return {compatible:false,reason:'Migration verification failed'}}
}


