// Strict read-only verifier of runner-supplied identity claims.
// It does NOT authenticate the runner. Trusted platform attestation is a separate gate.
const hex=/^[0-9a-f]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export function validateExecutionClaim(claim){
 if(!plain(claim)||!exact(claim,['schemaVersion','taskId','sourceCommit','runnerId','runnerImageHash','toolchainHash','receiptHash','attempt']))throw Error('INVALID_CLAIM');
 if(claim.schemaVersion!==1||typeof claim.taskId!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(claim.taskId))throw Error('INVALID_CLAIM');
 if(typeof claim.runnerId!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(claim.runnerId))throw Error('INVALID_CLAIM');
 if(![claim.sourceCommit,claim.runnerImageHash,claim.toolchainHash,claim.receiptHash].every(x=>typeof x==='string'&&hex.test(x)))throw Error('INVALID_CLAIM');
 if(!Number.isSafeInteger(claim.attempt)||claim.attempt<1||claim.attempt>2)throw Error('INVALID_CLAIM');
 return Object.freeze({taskId:claim.taskId,sourceCommit:claim.sourceCommit,trust:'UNATTESTED_CLAIM'});
}
export function correlateExecutionClaim(task,receipt,claim){
 const result=validateExecutionClaim(claim);
 if(task?.taskId!==claim.taskId||task?.sourceCommit!==claim.sourceCommit||receipt?.taskId!==claim.taskId||receipt?.sourceCommit!==claim.sourceCommit||receipt?.attempt!==claim.attempt||receipt?.toolchainHash!==claim.toolchainHash)throw Error('CLAIM_MISMATCH');
 return result;
}
