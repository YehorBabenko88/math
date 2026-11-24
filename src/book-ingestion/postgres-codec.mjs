import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {json,state,reviewReceipt,assert} from './queue-contract.mjs';

const MAX_BYTES=8*1024*1024;
const MAX_BASE64=4*Math.ceil(MAX_BYTES/3);
const FIELDS=['schemaVersion','encoding','byteLength','sha256','data'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

// JSON.stringify is applied only to a detached, descriptor-validated native
// value. Its escapes preserve NUL and lone UTF-16 surrogates in ASCII wire JSON.
export function encodeBookJSON(value){
 const native=json(value,MAX_BYTES);
 const bytes=Buffer.from(JSON.stringify(native),'utf8');
 return {schemaVersion:'book-json/v1',encoding:'base64-utf8-json',byteLength:bytes.length,sha256:hash(bytes),data:bytes.toString('base64')};
}

export function decodeBookJSON(envelope){
 assert(envelope&&typeof envelope==='object'&&!types.isProxy(envelope)&&!Array.isArray(envelope),'Invalid Book JSON envelope');
 assert([Object.prototype,null].includes(Object.getPrototypeOf(envelope)),'Invalid Book JSON envelope');
 const descriptors=Object.getOwnPropertyDescriptors(envelope),keys=Reflect.ownKeys(descriptors);
 assert(keys.length===FIELDS.length&&keys.every(k=>typeof k==='string'&&FIELDS.includes(k)&&Object.hasOwn(descriptors[k],'value')&&descriptors[k].enumerable),'Invalid Book JSON envelope');
 const {schemaVersion,encoding,byteLength,sha256,data}=Object.fromEntries(FIELDS.map(k=>[k,descriptors[k].value]));
 assert(schemaVersion==='book-json/v1'&&encoding==='base64-utf8-json','Invalid Book JSON version');
 assert(Number.isSafeInteger(byteLength)&&byteLength>=1&&byteLength<=MAX_BYTES&&typeof sha256==='string'&&/^[a-f0-9]{64}$/.test(sha256),'Invalid Book JSON metadata');
 // Bound and check the complete alphabet before allocating decoded bytes.
 assert(typeof data==='string'&&data.length<=MAX_BASE64&&data.length===4*Math.ceil(byteLength/3)&&/^[A-Za-z0-9+/]*={0,2}$/.test(data),'Invalid Book JSON base64');
 const padding=byteLength%3===1?2:byteLength%3===2?1:0;
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 assert((padding===0?!data.endsWith('='):data.endsWith('='.repeat(padding))&&data[data.length-padding-1]!=='=')&&(padding===0||alphabet.indexOf(data[data.length-padding-1])%(padding===2?16:4)===0),'Noncanonical Book JSON base64');
 const bytes=Buffer.from(data,'base64');
 assert(bytes.length===byteLength&&bytes.toString('base64')===data&&hash(bytes)===sha256,'Corrupt Book JSON');
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 assert(text.charCodeAt(0)!==0xfeff,'Invalid Book JSON BOM');
 const native=json(JSON.parse(text),MAX_BYTES);
 assert(JSON.stringify(native)===text,'Noncanonical Book JSON');
 return native;
}

// These columns remain useful for SQL constraints and indexing. The envelope is
// authoritative for text; placeholders never carry user UTF-16 into jsonb.
export function projectBookJob(input){
 const job=state({schemaVersion:1,maxAttempts:10,jobs:[json(input,MAX_BYTES)]},10).jobs[0];
 // Unknown to the native job schema, so older binaries fail closed instead of
 // accepting placeholder text as a real source when the strings happen to match.
 const projection={wireProjection:'book-json/v1',id:job.id,sourceHash:job.sourceHash,edition:'wire:v1',page:job.page,extractionVersion:'wire:v1',payload:{},state:job.state,attempts:job.attempts,createdAt:job.createdAt,updatedAt:job.updatedAt};
 if(job.state==='leased')Object.assign(projection,{token:job.token,leaseUntil:job.leaseUntil,workerId:'wire:v1'});
 if(Object.hasOwn(job,'checkpoint'))projection.checkpoint={};
 if(job.state==='completed')Object.assign(projection,{result:{},metrics:job.metrics});
 if(Object.hasOwn(job,'errorCode'))projection.errorCode=job.errorCode;
 return projection;
}

export function projectBookReview(input){
 const receipt=reviewReceipt(input);
 return {...receipt,wireProjection:'book-json/v1',reviewer:'wire:v1',reason:'wire:v1'};
}
