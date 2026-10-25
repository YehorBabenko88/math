import {gitObjectId} from './source-identity.mjs';
import {verifyReceiptOutput} from './artifacts.mjs';
// Strict shape validation only; never authenticates a runner or proof kernel.
const hex=/^[0-9a-f]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,ks)=>Object.keys(x).length===ks.length&&ks.every(k=>Object.hasOwn(x,k));
export function validateReceipt(receipt){
 if(!plain(receipt)||!exact(receipt,['schemaVersion','taskId','attempt','sourceCommit','inputHashes','outputHash','toolchainHash','result','metrics']))throw Error('INVALID_RECEIPT');
 if(receipt.schemaVersion!==1||typeof receipt.taskId!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(receipt.taskId)||!Number.isSafeInteger(receipt.attempt)||receipt.attempt<1||receipt.attempt>2)throw Error('INVALID_RECEIPT');
 if(!gitObjectId(receipt.sourceCommit)||![receipt.outputHash,receipt.toolchainHash].every(x=>typeof x==='string'&&hex.test(x)))throw Error('INVALID_RECEIPT');
 if(!Array.isArray(receipt.inputHashes)||receipt.inputHashes.length>32||!receipt.inputHashes.every(x=>typeof x==='string'&&hex.test(x)))throw Error('INVALID_RECEIPT');
 if(!['PASS','FAIL','BLOCKED'].includes(receipt.result))throw Error('INVALID_RECEIPT');
 const m=receipt.metrics;
 if(!plain(m)||!exact(m,['wallSeconds','peakMemoryMb','outputMb','llmTokens'])||!Object.values(m).every(x=>Number.isSafeInteger(x)&&x>=0))throw Error('INVALID_RECEIPT');
 return Object.freeze({taskId:receipt.taskId,result:receipt.result,trust:'SELF_REPORTED_UNATTESTED'});
}
export function matchReceipt(task,receipt){
 const accepted=validateReceipt(receipt);
 if(task?.taskId!==receipt.taskId||task?.sourceCommit!==receipt.sourceCommit||task?.inputs?.length!==receipt.inputHashes.length||!task.inputs.every((x,i)=>x.sha256===receipt.inputHashes[i]))throw Error('RECEIPT_MISMATCH');
 if(receipt.metrics.wallSeconds>task.budget.wallSeconds||receipt.metrics.peakMemoryMb>task.budget.memoryMb||receipt.metrics.outputMb>task.budget.outputMb||receipt.metrics.llmTokens>task.budget.llmTokens||receipt.attempt>task.budget.attempts)throw Error('BUDGET_EXCEEDED');
 return accepted;
}

// Correlate an untrusted receipt with actual output bytes; still NOT attestation.
export function matchReceiptAndOutput(task,receipt,outputBytes){
 const matched=matchReceipt(task,receipt);
 if(!(outputBytes instanceof Uint8Array))throw Error('INVALID_BYTES');
 if(!Number.isSafeInteger(task?.budget?.outputMb)||task.budget.outputMb<0)throw Error('INVALID_BUDGET');
 if(outputBytes.byteLength>task.budget.outputMb*1024*1024)throw Error('ACTUAL_OUTPUT_BUDGET_EXCEEDED');
 const integrity=verifyReceiptOutput(receipt,outputBytes);
 return Object.freeze({...matched,integrity:integrity.integrity,provenance:'UNATTESTED'});
}
