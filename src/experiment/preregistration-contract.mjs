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

 // Semantic identity excludes J enumeration ordinal/status and L retry ordinal.
 // Only trusted host-resolved J intent is accepted by the adapter.
export function semanticTrialBinding(input,intent){
 const {prereg:p}=validatePreregistration(input);
 const j=decodeMetadata(encodeMetadata(intent));
 const keys=['schema','developmentRef','policyRef','catalogRef','methodRef','portStateRef','ordinal','status'];
 if(!j||Array.isArray(j)||Object.keys(j).length!==keys.length||!keys.every(k=>Object.hasOwn(j,k))||j.schema!=='math.discovery.intent.v1'||j.status!=='UNREGISTERED'||!Number.isSafeInteger(j.ordinal)||j.ordinal<0||!keys.filter(k=>k.endsWith('Ref')).every(k=>isRef(j[k]))||semanticDigest(j.schema,j)!==p.intentRef)throw Error('INTENT_BINDING_MISMATCH');
 const binding={schema:'math.experiment.semantic.v1',developmentRef:j.developmentRef,policyRef:j.policyRef,catalogRef:j.catalogRef,methodRef:j.methodRef,portStateRef:j.portStateRef};
 for(const k of refs)if(k!=='intentRef')binding[k]=p[k];
 return Object.freeze({semanticRef:semanticDigest(binding.schema,binding),binding:Object.freeze(binding)});
}
