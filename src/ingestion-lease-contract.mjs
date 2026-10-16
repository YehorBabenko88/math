// A read-only claim representation, not a queue adapter or migration bridge.
import {safeJson,freezeJson,sha256} from './book-ingestion/json.mjs';
const invalid=()=>{throw Error('Invalid ingestion lease')};
const requireValue=ok=>{if(!ok)invalid()};
function field(record,name){
 requireValue(record&&typeof record==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(record)));
 const descriptor=Object.getOwnPropertyDescriptor(record,name);
 if(!descriptor)return undefined;
 requireValue(Object.hasOwn(descriptor,'value'));return descriptor.value;
}
function data(value){
 try{requireValue(value&&typeof value==='object'&&!Array.isArray(value));return safeJson(value,{maxBytes:8*1024*1024})}catch{invalid()}
}
function common({store,nativeJobId,claim_token,leaseUntilMs,workerId,attempt,payload,checkpoint,provenance}){
 requireValue(typeof workerId==='string'&&workerId.trim().length>0&&workerId.length<=128&&Number.isSafeInteger(attempt)&&attempt>0&&Number.isSafeInteger(leaseUntilMs)&&leaseUntilMs>=0);
 return freezeJson({schemaVersion:'mu-job-lease/v1',store,jobId:store+':'+nativeJobId,nativeJobId,claim_token,leaseUntilMs,workerId,attempt,payload:data(payload),checkpoint:checkpoint===undefined||checkpoint===null?null:data(checkpoint),provenance});
}
export function normalizeSqliteBookLease(job){
 const nativeJobId=field(job,'id'),claim_token=field(job,'token');
 const provenance={sourceHash:field(job,'sourceHash'),edition:field(job,'edition'),page:field(job,'page'),extractionVersion:field(job,'extractionVersion')};
 requireValue(field(job,'state')==='leased'&&typeof nativeJobId==='string'&&/^[a-f0-9]{64}$/.test(nativeJobId)&&typeof claim_token==='string'&&/^[a-f0-9]{64}$/.test(claim_token));
 requireValue(typeof provenance.sourceHash==='string'&&/^[a-f0-9]{64}$/.test(provenance.sourceHash)&&typeof provenance.edition==='string'&&provenance.edition.trim().length>0&&provenance.edition.length<=500&&Number.isSafeInteger(provenance.page)&&provenance.page>=1&&provenance.page<=1000000&&typeof provenance.extractionVersion==='string'&&provenance.extractionVersion.trim().length>0&&provenance.extractionVersion.length<=100);
 requireValue(nativeJobId===sha256(JSON.stringify([provenance.sourceHash,provenance.edition,provenance.page,provenance.extractionVersion])));
 return common({store:'book-sqlite',nativeJobId,claim_token,leaseUntilMs:field(job,'leaseUntil'),workerId:field(job,'workerId'),attempt:field(job,'attempts'),payload:field(job,'payload'),checkpoint:field(job,'checkpoint'),provenance});
}
export function normalizePostgresIngestionLease(claim){
 const id=field(claim,'job_id'),claim_token=field(claim,'claim_token'),expiry=field(claim,'lease_until');
 requireValue((typeof id==='string'&&/^[1-9]\d{0,18}$/.test(id)&&BigInt(id)<=9223372036854775807n)||(Number.isSafeInteger(id)&&id>0));
 requireValue(typeof claim_token==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claim_token));
 let leaseUntilMs;
 if(expiry instanceof Date){try{leaseUntilMs=Date.prototype.getTime.call(expiry)}catch{invalid()}}
 else if(typeof expiry==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiry)){leaseUntilMs=Date.parse(expiry);requireValue(Number.isFinite(leaseUntilMs)&&new Date(leaseUntilMs).toISOString()===expiry)}
 else invalid();
 return common({store:'postgres-ingestion',nativeJobId:String(id),claim_token,leaseUntilMs,workerId:field(claim,'worker_id'),attempt:field(claim,'attempts'),payload:field(claim,'payload'),checkpoint:field(claim,'checkpoint'),provenance:null});
}
