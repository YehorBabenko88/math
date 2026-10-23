import {sha256} from './artifacts.mjs';
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

export function correlateExecutionClaimWithReceiptBytes(task,receipt,claim,receiptBytes){
 const matched=correlateExecutionClaim(task,receipt,claim);
 if(!(receiptBytes instanceof Uint8Array))throw Error('INVALID_RECEIPT_BYTES');
 if(receiptBytes.byteLength>1024*1024)throw Error('RECEIPT_TOO_LARGE');
 if(sha256(receiptBytes)!==claim.receiptHash)throw Error('RECEIPT_HASH_MISMATCH');
 let decoded;
 try{decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(receiptBytes));}
 catch{throw Error('INVALID_RECEIPT_BYTES');}
 if(decoded===null||typeof decoded!=='object'||Array.isArray(decoded))throw Error('INVALID_RECEIPT_BYTES');
 // Caller-supplied receipt must match the exact bytes, not just selected claim fields.
 if(!sameRecord(decoded,receipt))throw Error('RECEIPT_BYTES_MISMATCH');
 return matched;
}
function sameRecord(a,b){
 if(a===b)return true;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)!==Array.isArray(b))return false;
 const ka=Object.keys(a),kb=Object.keys(b);
 return ka.length===kb.length&&ka.every(k=>Object.hasOwn(b,k)&&sameRecord(a[k],b[k]));
}
