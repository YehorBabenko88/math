// Pure deterministic planning state machine. No I/O, no execution, no publication.
import {validateTask} from './policy.mjs';
const transitions=Object.freeze({
 PENDING:['LEASED','CANCELLED'],
 LEASED:['RUNNING','EXPIRED','CANCELLED'],
 RUNNING:['TESTED','FAILED','EXPIRED','CANCELLED'],
 TESTED:['REVIEW_REQUIRED','REJECTED'],
 REVIEW_REQUIRED:['REJECTED'],
 FAILED:[],EXPIRED:[],CANCELLED:[],REJECTED:[]
});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const token=/^[a-zA-Z0-9_-]{16,128}$/;
export function newPlan(task){
 const accepted=validateTask(task);
 return Object.freeze({...accepted,state:'PENDING',generation:0,attempt:0,leaseToken:null});
}
export function advance(plan,{to,expectedGeneration,leaseToken=null}={}){
 if(!plain(plan)||!Number.isSafeInteger(plan.generation)||plan.generation<0||!Number.isSafeInteger(plan.attempt)||plan.attempt<0)throw Error('INVALID_PLAN');
 if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration!==plan.generation)throw Error('STALE_GENERATION');
 if(!transitions[plan.state]?.includes(to))throw Error('INVALID_TRANSITION');
 if(plan.state==='LEASED'||plan.state==='RUNNING'){
  if(typeof leaseToken!=='string'||!token.test(leaseToken)||leaseToken!==plan.leaseToken)throw Error('LEASE_REJECTED');
 }
 if(to==='LEASED'){
  if(typeof leaseToken!=='string'||!token.test(leaseToken))throw Error('LEASE_REJECTED');
  if(plan.attempt>=2)throw Error('ATTEMPTS_EXHAUSTED');
 }
 if(to==='RUNNING'&&plan.state!=='LEASED')throw Error('INVALID_TRANSITION');
 // REVIEW_REQUIRED is not VERIFIED or RELEASED. No such transitions exist.
 return Object.freeze({...plan,state:to,generation:plan.generation+1,attempt:to==='LEASED'?plan.attempt+1:plan.attempt,leaseToken:to==='LEASED'?leaseToken:(to==='RUNNING'?plan.leaseToken:null)});
}
