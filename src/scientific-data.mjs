import {types} from 'node:util';
import {createHash} from 'node:crypto';
// Snapshot only inert bounded JSON. Never invoke caller getters/toJSON/proxies.
export function snapshotJSON(input){
 let properties=0;const active=new Set();
 function copy(v,depth){
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('NONFINITE_INPUT');return v;}
  if(typeof v==='string'){if(v.length>262144)throw Error('TEXT_LIMIT');return v;}
  if(typeof v!=='object'||types.isProxy(v)||depth>24||active.has(v))throw Error('INERT_JSON_REQUIRED');
  const array=Array.isArray(v);
  if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype))throw Error('INERT_JSON_REQUIRED');
  const ds=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(ds);
  if((properties+=keys.length)>100000)throw Error('PROPERTY_LIMIT');
  active.add(v);const entries=[];
  for(const k of keys){
   const d=ds[k];if(array&&k==='length')continue;
   if(typeof k!=='string'||!d.enumerable||!Object.hasOwn(d,'value')||['__proto__','constructor','prototype'].includes(k))throw Error('INERT_JSON_REQUIRED');
   entries.push([k,copy(d.value,depth+1)]);
  }
  active.delete(v);
  if(array){if(entries.length!==v.length||entries.some(([k],i)=>k!==String(i)))throw Error('DENSE_ARRAY_REQUIRED');return entries.map(([,x])=>x);}
  return Object.fromEntries(entries);
 }
 const out=copy(input,0);if(Buffer.byteLength(JSON.stringify(out))>262144)throw Error('DOCUMENT_LIMIT');return out;
}
export function exact(v,required,optional=[]){
 if(!v||typeof v!=='object'||Array.isArray(v)||required.some(k=>!Object.hasOwn(v,k))||Object.keys(v).some(k=>!required.includes(k)&&!optional.includes(k)))throw Error('INVALID_FIELDS');
}
export function text(v,max=128){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('INVALID_TEXT');return v;}
export function digest(v){if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw Error('INVALID_SHA256');return v;}
export function canonical(v){return JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);}
export const fingerprint=v=>createHash('sha256').update(canonical(v)).digest('hex');
