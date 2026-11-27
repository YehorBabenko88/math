import {encodeMetadata,decodeMetadata} from '../math-universe-codec.mjs';
const fail=()=>{throw Error('INVALID_SCHEMA');};
const ref=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uint=x=>Number.isSafeInteger(x)&&x>=0&&!Object.is(x,-0);
const closed=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const inert=x=>{try{return decodeMetadata(encodeMetadata(x));}catch{fail();}};
const fields=['objective_id','objective_version','target_ref','unit','direction','baseline_ref','fold_roster_ref','aggregation','uncertainty_kind','confidence_level','cost_policy_ref'];
export function compareDevelopmentCohorts(a,b){
 a=inert(a);b=inert(b);
 for(const x of [a,b]){
  if(!closed(x,fields)||!['target_ref','baseline_ref','fold_roster_ref','cost_policy_ref'].every(k=>ref(x[k]))||!fields.filter(k=>!k.endsWith('_ref')).every(k=>typeof x[k]==='string'&&x[k].length>0&&x[k].length<=128))fail();
 }
 return Object.freeze({status:fields.every(k=>a[k]===b[k])?'COMPARABLE_SHAPE_ONLY':'ABSTAIN',qualified:false});
}
