import {encodeMetadata,decodeMetadata} from '../math-universe-codec.mjs';
const fail=()=>{throw Error('INVALID_SCHEMA');};
const ref=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uint=x=>Number.isSafeInteger(x)&&x>=0&&!Object.is(x,-0);
const closed=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const inert=x=>{try{return decodeMetadata(encodeMetadata(x));}catch{fail();}};
export function validateManifest(input){
 const x=inert(input);
 if(!closed(x,['schema','developmentRef','policyRef','catalogRef','splitRef'])||x.schema!=='math.experiment.manifest.v1'||!['developmentRef','policyRef','catalogRef','splitRef'].every(k=>ref(x[k])))fail();
 return Object.freeze(x);
}
