import {createHash} from 'node:crypto';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function safeJson(input,{maxBytes=2_000_000}={}){
 if(typeof input==='string'){if(Buffer.byteLength(input)>maxBytes)throw Error('JSON size limit');try{input=JSON.parse(input)}catch{throw Error('Invalid JSON')}}
 let count=0;const active=new Set();
 function visit(value,depth){
  if(++count>30000||depth>48)throw Error('JSON complexity limit');
  if(value===null||typeof value==='boolean'||typeof value==='string')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(!value||typeof value!=='object'||active.has(value))throw Error('JSON data required');
  const array=Array.isArray(value);if(Object.getPrototypeOf(value)!==(array?Array.prototype:Object.prototype)&&Object.getPrototypeOf(value)!==null)throw Error('Plain JSON required');
  if(array&&value.length>10000)throw Error('JSON collection limit');
  active.add(value);const result=array?[]:{};
  const keys=Reflect.ownKeys(value);
  if(array&&(keys.length!==value.length+1||!keys.includes('length')))throw Error('Dense JSON array required');
  for(const key of keys){if(array&&key==='length')continue;
   if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)||array&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length))throw Error('Invalid JSON key');
   const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!Object.hasOwn(descriptor,'value'))throw Error('JSON accessors forbidden');
   result[key]=visit(descriptor.value,depth+1);
  }active.delete(value);return result;
 }
 const result=visit(input,0);if(Buffer.byteLength(JSON.stringify(result))>maxBytes)throw Error('JSON size limit');return result;
}
export function freezeJson(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freezeJson(v);Object.freeze(value)}return value}
export function canonicalJSON(value){value=safeJson(value);const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;return JSON.stringify(sort(value))}
