import {encodeMetadata,decodeMetadata} from '../math-universe-codec.mjs';
const fail=()=>{throw Error('INVALID_SCHEMA');};
const ref=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uint=x=>Number.isSafeInteger(x)&&x>=0&&!Object.is(x,-0);
const closed=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const inert=x=>{try{return decodeMetadata(encodeMetadata(x));}catch{fail();}};
import {semanticDigest} from '../math-universe-codec.mjs';
// Pure terminal attempt DTO; persistence, duplicate registration and authorization belong to the trusted host.
export function registerAttempt(input){
 const x=inert(input);
 if(!closed(x,['schema','intentRef','foldRef','ordinal','status','metricRef'])||x.schema!=='math.experiment.attempt.v1'||!ref(x.intentRef)||!ref(x.foldRef)||!uint(x.ordinal)||!['COMPLETED','FAILED','CANCELLED','INVALID','PRUNED','REJECTED'].includes(x.status)||(x.status==='COMPLETED'?!ref(x.metricRef):x.metricRef!==null))fail();
 const attemptRef=semanticDigest('math.experiment.attempt.identity.v1',{intentRef:x.intentRef,foldRef:x.foldRef,ordinal:x.ordinal});
 return Object.freeze({attemptRef,attempt:Object.freeze(x),qualified:false});
}
