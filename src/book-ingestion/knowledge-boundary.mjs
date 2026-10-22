import {createHash,timingSafeEqual} from 'node:crypto';
import {types} from 'node:util';

// A pure validation boundary. It does not execute source content or promote
// human/LLM review into mathematical verification.
const STATUSES=new Set(['EXTRACTED','LLM_CANDIDATE','SOURCE_REVIEWED','FORMALIZED','KERNEL_VERIFIED','REJECTED']);
const HEX=/^[a-f0-9]{64}$/;
function plain(v){return v!==null&&typeof v==='object'&&!types.isProxy(v)&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));}
function data(v,k){const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw Error('Invalid extraction candidate');return d.value;}
function string(v,max=512){return typeof v==='string'&&v.length>0&&v.length<=max;}
function exact(v,fields){if(!plain(v))return false;const ds=Object.getOwnPropertyDescriptors(v);return Reflect.ownKeys(ds).length===fields.length&&fields.every(k=>Object.hasOwn(ds,k)&&Object.hasOwn(ds[k],'value')&&ds[k].enumerable);}
function digest(v){return typeof v==='string'&&HEX.test(v);}
export function candidateDigest(source){
 if(!exact(source,['sourceHash','edition','page','extractionVersion','text']))throw Error('Invalid extraction candidate');
 const hash=data(source,'sourceHash'),edition=data(source,'edition'),page=data(source,'page'),version=data(source,'extractionVersion'),value=data(source,'text');
 if(!digest(hash)||!string(edition)||!Number.isSafeInteger(page)||page<1||!string(version,100)||!string(value,262144))throw Error('Invalid extraction candidate');
 if(Buffer.byteLength(value,'utf8')>262144)throw Error('Invalid extraction candidate');
 return createHash('sha256').update(JSON.stringify([hash,edition,page,version,value])).digest('hex');
}
export function assessKnowledge(candidate,{kernelReceipt}={}){
 if(!exact(candidate,['source','status']))throw Error('Invalid knowledge candidate');
 const hash=candidateDigest(candidate.source);
 if(!STATUSES.has(candidate.status))throw Error('Invalid knowledge status');
 if(candidate.status==='KERNEL_VERIFIED'){
  // This module intentionally cannot authenticate a proof kernel. Only a
  // separately trusted kernel verifier can produce a verified publication.
  throw Error('Independent proof kernel verification required');
 }
 if(kernelReceipt!==undefined)throw Error('Untrusted kernel receipt');
 return Object.freeze({candidateDigest:hash,status:candidate.status,mathematicallyVerified:false});
}
export function sameDigest(a,b){
 if(!digest(a)||!digest(b))return false;
 return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}

const CLAIM_FIELDS=['status','knowledgeStatus','verificationStatus'];
const VERIFIED_CLAIMS=new Set(['VERIFIED','KERNEL_VERIFIED','PROVEN','MATHEMATICALLY_VERIFIED']);
export function rejectUntrustedVerification(result){
 if(!plain(result))throw Error('Invalid knowledge result');
 const seen=new Set();
 function inspect(value,depth){
  if(value===null||typeof value!=='object')return;
  if(depth>24||seen.has(value))throw Error('Invalid knowledge result');
  seen.add(value);
  for(const [field,item] of Object.entries(value)){
   if(CLAIM_FIELDS.includes(field)&&VERIFIED_CLAIMS.has(item))
    throw Error('Independent proof kernel verification required');
   if(field==='mathematicallyVerified'&&item!==false)
    throw Error('Independent proof kernel verification required');
   inspect(item,depth+1);
  }
  seen.delete(value);
 }
 inspect(result,0);
 return result;
}
