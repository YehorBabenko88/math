import {encodeMetadata,decodeMetadata,semanticDigest} from '../math-universe-codec.mjs';
const refs=['intentRef','foldRef','manifestRef','cohortRef','inputRef','seedRef','budgetPolicyRef','snapshotRef','fitRef','availabilityRef'];
const isRef=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function validatePreregistration(input){
 const x=decodeMetadata(encodeMetadata(input));
 const keys=['schema','ordinal',...refs];
 if(!x||Array.isArray(x)||Object.keys(x).length!==keys.length||!keys.every(k=>Object.hasOwn(x,k))||x.schema!=='math.experiment.preregistration.v1'||!refs.every(k=>isRef(x[k]))||!Number.isSafeInteger(x.ordinal)||x.ordinal<0)throw Error('INVALID_PREREGISTRATION');
 const attemptRef=semanticDigest('math.experiment.attempt.identity.v1',{intentRef:x.intentRef,foldRef:x.foldRef,ordinal:x.ordinal});
 return Object.freeze({attemptRef,preregRef:semanticDigest(x.schema,x),prereg:Object.freeze(x)});
}
