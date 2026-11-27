import {encodeMetadata,decodeMetadata} from '../math-universe-codec.mjs';
const fail=()=>{throw Error('INVALID_SCHEMA');};
const ref=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uint=x=>Number.isSafeInteger(x)&&x>=0&&!Object.is(x,-0);
const closed=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const inert=x=>{try{return decodeMetadata(encodeMetadata(x));}catch{fail();}};
export function validateSplitPlan(input){
 const x=inert(input);
 if(!closed(x,['schema','folds','purgeMs','embargoMs'])||x.schema!=='math.experiment.split.v1'||!uint(x.purgeMs)||!uint(x.embargoMs)||!Array.isArray(x.folds)||!x.folds.length)fail();
 const seen=new Set();let end=null;
 for(const f of x.folds){
  if(!closed(f,['foldRef','trainStartMs','trainEndMs','validationStartMs','validationEndMs'])||!ref(f.foldRef)||seen.has(f.foldRef)||!['trainStartMs','trainEndMs','validationStartMs','validationEndMs'].every(k=>uint(f[k])))fail();
  if(f.trainStartMs>=f.trainEndMs||f.trainEndMs>f.validationStartMs||f.validationStartMs>=f.validationEndMs||f.validationStartMs-f.trainEndMs<x.purgeMs||(end!==null&&(f.validationStartMs<end||f.validationStartMs-end<x.embargoMs)))fail();
  seen.add(f.foldRef);end=f.validationEndMs;Object.freeze(f);
 }
 Object.freeze(x.folds);return Object.freeze(x);
}
