// Pure planning policy: no execution, verification or publication authority.
export const KINDS=Object.freeze(['INGEST','GAP_SCAN','HYPOTHESIS','ADAPTER_BUILD','SANDBOX_TEST','PROOF_CHECK','RELEASE_CANDIDATE']);
export const ROLES=Object.freeze(['ingestion','research','codex','test','kernel','publisher']);
const allowed=Object.freeze({INGEST:'ingestion',GAP_SCAN:'research',HYPOTHESIS:'research',ADAPTER_BUILD:'codex',SANDBOX_TEST:'test',PROOF_CHECK:'kernel',RELEASE_CANDIDATE:'publisher'});
const hex=/^[0-9a-f]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,ks)=>Object.keys(x).length===ks.length&&ks.every(k=>Object.hasOwn(x,k));
export function validateTask(task){
 if(!plain(task)||!exact(task,['schemaVersion','taskId','kind','role','sourceCommit','inputs','budget','permissions']))throw Error('INVALID_TASK');
 if(task.schemaVersion!==1||typeof task.taskId!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(task.taskId))throw Error('INVALID_TASK');
 if(!KINDS.includes(task.kind)||!ROLES.includes(task.role)||allowed[task.kind]!==task.role||typeof task.sourceCommit!=='string'||!hex.test(task.sourceCommit))throw Error('INVALID_TASK');
 if(!Array.isArray(task.inputs)||task.inputs.length>32||!task.inputs.every(x=>plain(x)&&exact(x,['sha256','trust'])&&typeof x.sha256==='string'&&hex.test(x.sha256)&&x.trust==='UNTRUSTED'))throw Error('INVALID_TASK');
 const b=task.budget;
 if(!plain(b)||!exact(b,['wallSeconds','memoryMb','outputMb','llmTokens','attempts'])||!Object.entries({wallSeconds:600,memoryMb:1024,outputMb:50,llmTokens:20000,attempts:2}).every(([k,max])=>Number.isSafeInteger(b[k])&&b[k]>=0&&b[k]<=max))throw Error('INVALID_BUDGET');
 const p=task.permissions;
 if(!plain(p)||!exact(p,['network','productionWrite','kernelWrite'])||p.network!==false||p.productionWrite!==false||p.kernelWrite!==false)throw Error('DENIED');
 // Approval is never accepted from a task payload. The trusted publication service
 // must authenticate an owner and bind authorization to immutable artifact hashes.
 if(task.kind==='RELEASE_CANDIDATE')throw Error('PUBLICATION_NOT_IMPLEMENTED');
 return Object.freeze({taskId:task.taskId,kind:task.kind,role:task.role,sourceCommit:task.sourceCommit});
}
export function classifyResult({kind}={}){
 if(kind==='ADAPTER_BUILD'||kind==='SANDBOX_TEST')return 'ADAPTER_TESTED';
 // A boolean from any caller cannot attest an independent proof kernel.
 return 'CANDIDATE';
}
