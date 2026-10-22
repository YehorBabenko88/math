// Fail-closed planning policy. This module never executes jobs or publishes artifacts.
export const KINDS=Object.freeze(['INGEST','GAP_SCAN','HYPOTHESIS','ADAPTER_BUILD','SANDBOX_TEST','PROOF_CHECK','RELEASE_CANDIDATE']);
export const ROLES=Object.freeze(['ingestion','research','codex','test','kernel','publisher']);
const allowed=Object.freeze({INGEST:'ingestion',GAP_SCAN:'research',HYPOTHESIS:'research',ADAPTER_BUILD:'codex',SANDBOX_TEST:'test',PROOF_CHECK:'kernel',RELEASE_CANDIDATE:'publisher'});
const hex=/^[0-9a-f]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const keys=(x,ks)=>Object.keys(x).every(k=>ks.includes(k));
export function validateTask(task){
 if(!plain(task)||!keys(task,['schemaVersion','taskId','kind','role','sourceCommit','inputs','budget','permissions','approval']))throw Error('INVALID_TASK');
 if(task.schemaVersion!==1||typeof task.taskId!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(task.taskId))throw Error('INVALID_TASK');
 if(!KINDS.includes(task.kind)||!ROLES.includes(task.role)||allowed[task.kind]!==task.role||!hex.test(task.sourceCommit))throw Error('INVALID_TASK');
 if(!Array.isArray(task.inputs)||task.inputs.length>32||!task.inputs.every(x=>plain(x)&&keys(x,['sha256','trust'])&&hex.test(x.sha256)&&x.trust==='UNTRUSTED'))throw Error('INVALID_TASK');
 const b=task.budget;
 if(!plain(b)||!keys(b,['wallSeconds','memoryMb','outputMb','llmTokens','attempts'])||!Object.entries({wallSeconds:600,memoryMb:1024,outputMb:50,llmTokens:20000,attempts:2}).every(([k,max])=>Number.isSafeInteger(b[k])&&b[k]>=0&&b[k]<=max))throw Error('INVALID_BUDGET');
 const p=task.permissions;
 if(!plain(p)||!keys(p,['network','productionWrite','kernelWrite'])||p.network!==false||p.productionWrite!==false||p.kernelWrite!==false)throw Error('DENIED');
 if(task.kind==='RELEASE_CANDIDATE'&&task.approval!==true)throw Error('APPROVAL_REQUIRED');
 if(task.kind!=='RELEASE_CANDIDATE'&&task.approval!==undefined)throw Error('INVALID_TASK');
 return Object.freeze({taskId:task.taskId,kind:task.kind,role:task.role,sourceCommit:task.sourceCommit});
}
export function classifyResult({kind,proofVerified=false}={}){
 if(kind==='PROOF_CHECK'&&proofVerified===true)return 'PROOF_CHECKED';
 if(kind==='ADAPTER_BUILD'||kind==='SANDBOX_TEST')return 'ADAPTER_TESTED';
 return 'CANDIDATE';
}
