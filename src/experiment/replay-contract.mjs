import {encodeMetadata,decodeMetadata} from '../math-universe-codec.mjs';
const fail=()=>{throw Error('INVALID_SCHEMA');};
const ref=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uint=x=>Number.isSafeInteger(x)&&x>=0&&!Object.is(x,-0);
const closed=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const inert=x=>{try{return decodeMetadata(encodeMetadata(x));}catch{fail();}};
export function validateReplay(input){
 const x=inert(input);
 if(!closed(x,['schema','attemptRef','inputRef','resultRef'])||x.schema!=='math.experiment.replay.v1'||!['attemptRef','inputRef','resultRef'].every(k=>ref(x[k])))fail();
 return Object.freeze(x);
}
