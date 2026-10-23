import {rejectUntrustedVerification} from './knowledge-boundary.mjs';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {types} from 'node:util';
const MAX_BYTES=8*1024*1024,MAX_JOBS=1000;
const FIELDS=['id','sourceHash','edition','page','extractionVersion','payload','state','attempts','token','leaseUntil','workerId','createdAt','updatedAt','checkpoint','result','metrics','errorCode'];
const JSON_FIELDS=['payload','checkpoint','result','metrics'];
const OPTIONAL=['token','leaseUntil','workerId','checkpoint','result','metrics','errorCode'];
const assert=(ok,message='Invalid queue input')=>{if(!ok)throw Error(message)};
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;

// Inspect descriptors before reading values. No getters, toJSON hooks, cycles,
// exotic prototypes or executable expressions are accepted at the boundary.
function json(value,maxBytes=262144){
 let nodes=0,bytes=0;const seen=new Set();
 function visit(v,depth){
  bytes+=4;assert(++nodes<=20000&&depth<=24&&bytes<=maxBytes);
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='number'){assert(Number.isFinite(v));return;}
  if(typeof v==='string'){bytes+=Buffer.byteLength(v);assert(bytes<=maxBytes);return;}
  assert(v&&typeof v==='object'&&!types.isProxy(v)&&!seen.has(v));seen.add(v);
  const array=Array.isArray(v);assert(array?Object.getPrototypeOf(v)===Array.prototype:[Object.prototype,null].includes(Object.getPrototypeOf(v)));
  const descriptors=Object.getOwnPropertyDescriptors(v),names=Reflect.ownKeys(descriptors);
  assert(names.length<=20000);
  if(array){assert(v.length<=20000);assert(names.length===v.length+1);}
  for(const name of names){
   assert(typeof name==='string'&&!['__proto__','constructor','prototype'].includes(name));
   bytes+=Buffer.byteLength(name);assert(bytes<=maxBytes);
   const d=descriptors[name];assert(Object.hasOwn(d,'value'));
   if(array&&name==='length')continue;
   assert(d.enumerable&&(!array||/^(0|[1-9]\d*)$/.test(name)&&Number(name)<v.length));
   visit(d.value,depth+1);
  }
  seen.delete(v);
 }
 visit(value,0);const encoded=JSON.stringify(value);assert(Buffer.byteLength(encoded)<=maxBytes);return JSON.parse(encoded);
}
function object(v,allowed){assert(v&&typeof v==='object'&&!Array.isArray(v));assert(Object.keys(v).every(k=>allowed.includes(k)));}
function plain(v){assert(v&&typeof v==='object'&&!Array.isArray(v));}
function key(input){return createHash('sha256').update(JSON.stringify([input.sourceHash,input.edition,input.page,input.extractionVersion])).digest('hex');}
function source(input){
 assert(typeof input.sourceHash==='string'&&/^[a-f0-9]{64}$/.test(input.sourceHash));
 assert(text(input.edition,500)&&integer(input.page,1,1000000)&&text(input.extractionVersion,100));plain(input.payload);json(input.payload,65536);
}
function metrics(v){plain(v);assert(Object.keys(v).length<=(Object.hasOwn(v,'reviewDecisions')?31:30)&&Object.entries(v).every(([k,n])=>/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(k)&&typeof n==='number'&&Number.isFinite(n)&&n>=0));}
const REVIEW_FIELDS=['candidateDigest','decision','reviewer','reason','reviewedAt','visualVerified'];
function reviewReceipt(input){
 const r=json(input,8192);object(r,REVIEW_FIELDS);assert(Object.keys(r).length===REVIEW_FIELDS.length);
 assert(typeof r.candidateDigest==='string'&&/^[a-f0-9]{64}$/.test(r.candidateDigest)&&['approved','rejected'].includes(r.decision)&&typeof r.visualVerified==='boolean');
 for(const name of ['reviewer','reason'])assert(text(r[name],name==='reviewer'?200:1000)&&!/[\u0000-\u001f\u007f]/.test(r[name]));
 assert(typeof r.reviewedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.reviewedAt)&&Number.isFinite(Date.parse(r.reviewedAt))&&new Date(r.reviewedAt).toISOString()===r.reviewedAt);
 return Object.fromEntries(REVIEW_FIELDS.map(name=>[name,r[name]]));
}
function state(document,maxAttempts){
 try{
  object(document,['schemaVersion','maxAttempts','jobs']);assert(document.schemaVersion===1&&document.maxAttempts===maxAttempts&&Array.isArray(document.jobs)&&document.jobs.length<=MAX_JOBS);
  const ids=new Set();
  for(const j of document.jobs){object(j,FIELDS);source(j);assert(j.id===key(j)&&!ids.has(j.id));ids.add(j.id);
   assert(['queued','leased','completed','failed'].includes(j.state)&&integer(j.attempts,0,maxAttempts));
   assert(integer(j.createdAt,0,Number.MAX_SAFE_INTEGER)&&integer(j.updatedAt,j.createdAt,Number.MAX_SAFE_INTEGER));
   if(j.state==='leased'){assert(integer(j.attempts,1,maxAttempts)&&typeof j.token==='string'&&/^[a-f0-9]{64}$/.test(j.token)&&text(j.workerId,100)&&integer(j.leaseUntil,j.updatedAt+1,Number.MAX_SAFE_INTEGER));}
   else assert(j.token===undefined&&j.workerId===undefined&&j.leaseUntil===undefined);
   if(j.state==='completed'){assert(j.attempts>0);plain(j.result);json(j.result);rejectUntrustedVerification(j.result);metrics(j.metrics);assert(j.errorCode===undefined);}
   else assert(j.result===undefined&&j.metrics===undefined);
   if(j.state==='queued')assert(j.attempts<maxAttempts);
   if(j.state==='failed')assert(j.attempts>0&&j.errorCode!==undefined);
   if(j.errorCode!==undefined)assert(typeof j.errorCode==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(j.errorCode));
   if(j.checkpoint!==undefined){plain(j.checkpoint);json(j.checkpoint);}
  }
  return json(document,MAX_BYTES);
 }catch{throw Error('Invalid queue state');}
}
function clearLease(j){delete j.token;delete j.workerId;delete j.leaseUntil;}
function recover(jobs,time,maxAttempts){
 for(const j of jobs)if(j.state==='leased'&&j.leaseUntil<=time){clearLease(j);j.state=j.attempts>=maxAttempts?'failed':'queued';j.errorCode='LEASE_EXPIRED';j.updatedAt=Math.max(time,j.updatedAt);}
}
export function createBookQueueAPI({transaction,maxAttempts}){
 function fenced(d,id,token,time){assert(typeof id==='string'&&/^[a-f0-9]{64}$/.test(id));assert(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token));const j=d.jobs.find(j=>j.id===id);assert(j?.state==='leased'&&j.leaseUntil>time&&timingSafeEqual(Buffer.from(j.token,'hex'),Buffer.from(token,'hex')),'Lease rejected');return j;}
 return {
  async enqueue(input){const data=json(input,70000);object(data,['sourceHash','edition','page','extractionVersion','payload']);source(data);return transaction((d,time)=>{const id=key(data),old=d.jobs.find(j=>j.id===id);if(old)return old;assert(d.jobs.length<MAX_JOBS,'Queue capacity reached');const job={...data,id,state:'queued',attempts:0,createdAt:time,updatedAt:time};d.jobs.push(job);return job;});},
  async acquire(options){const opts=json(options);object(opts,['workerId','leaseMs','jobId']);assert(text(opts.workerId,100)&&integer(opts.leaseMs,1,86400000));if(Object.hasOwn(opts,'jobId'))assert(typeof opts.jobId==='string'&&/^[a-f0-9]{64}$/.test(opts.jobId));return transaction((d,time)=>{recover(d.jobs,time,maxAttempts);const j=d.jobs.find(j=>j.state==='queued'&&(opts.jobId===undefined||j.id===opts.jobId));if(!j)return null;Object.assign(j,{state:'leased',attempts:j.attempts+1,token:randomBytes(32).toString('hex'),workerId:opts.workerId,leaseUntil:time+opts.leaseMs,updatedAt:Math.max(time,j.updatedAt)});return j;});},
  async renew(id,token,options){const opts=json(options);object(opts,['leaseMs']);assert(integer(opts.leaseMs,1,86400000));return transaction((d,time)=>{const j=fenced(d,id,token,time);j.leaseUntil=time+opts.leaseMs;j.updatedAt=Math.max(time,j.updatedAt);return j;});},
  async checkpoint(id,token,data){const checkpoint=json(data);plain(checkpoint);return transaction((d,time)=>{const j=fenced(d,id,token,time);j.checkpoint=checkpoint;j.updatedAt=Math.max(time,j.updatedAt);return j;});},
  async complete(id,token,data){const input=json(data);object(input,['result','metrics']);plain(input.result);rejectUntrustedVerification(input.result);metrics(input.metrics);return transaction((d,time)=>{const j=fenced(d,id,token,time);Object.assign(j,{state:'completed',result:input.result,metrics:input.metrics,updatedAt:Math.max(time,j.updatedAt)});clearLease(j);delete j.errorCode;return j;});},
  async fail(id,token,options){const opts=json(options);object(opts,['code','retryable']);assert(typeof opts.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(opts.code)&&(opts.retryable===undefined||typeof opts.retryable==='boolean'));return transaction((d,time)=>{const j=fenced(d,id,token,time);Object.assign(j,{state:opts.retryable!==false&&j.attempts<maxAttempts?'queued':'failed',errorCode:opts.code,updatedAt:Math.max(time,j.updatedAt)});clearLease(j);return j;});},
  async recordReview(id,receipt){assert(typeof id==='string'&&/^[a-f0-9]{64}$/.test(id));const r=reviewReceipt(receipt);return transaction((d,time)=>{const j=d.jobs.find(j=>j.id===id);assert(j?.state==='completed'&&j.result.digest===r.candidateDigest);if(Object.hasOwn(j.result,'reviewReceipt')){assert(JSON.stringify(reviewReceipt(j.result.reviewReceipt))===JSON.stringify(r));return j;}j.result.reviewReceipt=r;j.metrics.reviewDecisions=1;j.updatedAt=Math.max(time,j.updatedAt);return j;});},
  async get(id){assert(typeof id==='string'&&/^[a-f0-9]{64}$/.test(id));return transaction(d=>d.jobs.find(j=>j.id===id)??null);},
  async list(){return transaction(d=>d.jobs);},
  async exportSnapshot(){return transaction(d=>d);},
  async importSnapshot(input){let document;try{if(typeof input==='string')assert(Buffer.byteLength(input)<=MAX_BYTES);document=state(json(typeof input==='string'?JSON.parse(input):input,MAX_BYTES),maxAttempts);}catch{throw Error('Invalid queue state');}return transaction((d,time)=>{assert(d.jobs.length===0,'Queue is not empty');d.jobs=document.jobs;for(const j of d.jobs)if(j.state==='leased'){clearLease(j);j.state=j.attempts>=maxAttempts?'failed':'queued';j.errorCode='RESTORED_LEASE';j.updatedAt=Math.max(time,j.updatedAt);}return d;});}
 };
}

export function validateBookSnapshot(input,maxAttempts){
 try{if(typeof input==='string')assert(Buffer.byteLength(input)<=MAX_BYTES);return state(json(typeof input==='string'?JSON.parse(input):input,MAX_BYTES),maxAttempts)}catch{throw Error('Invalid queue state')}
}
// Match SQLite load's ORDER BY createdAt,id, including equal-clock jobs.
export function orderBookJobs(jobs){return jobs.sort((a,b)=>a.createdAt-b.createdAt||(a.id<b.id?-1:a.id>b.id?1:0));}
export {json,state,recover,assert,integer,reviewReceipt};
