// Pure trust-boundary decision: metadata checks cannot authorize publication.
export function assessOrchestratorEvidence(evidence){
 if(evidence===null||typeof evidence!=='object'||Array.isArray(evidence)||Object.getPrototypeOf(evidence)!==Object.prototype)throw Error('INVALID_EVIDENCE');
 const keys=Reflect.ownKeys(evidence);
 if(keys.length!==4||!['source','receipt','runner','kernel'].every(k=>Object.hasOwn(evidence,k)))throw Error('INVALID_EVIDENCE');
 const descriptors=Object.getOwnPropertyDescriptors(evidence);
 if(!['source','receipt','runner','kernel'].every(k=>Object.hasOwn(descriptors[k],'value')&&descriptors[k].enumerable))throw Error('INVALID_EVIDENCE');
 // Deliberately ignore caller-supplied verdicts, approvals and purported trust flags.
 return Object.freeze({source:'UNRESOLVED',receipt:'UNATTESTED',runner:'UNATTESTED',kernel:'NOT_INDEPENDENTLY_VERIFIED',publication:'DENIED'});
}
