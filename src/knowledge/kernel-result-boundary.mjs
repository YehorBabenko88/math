import {inertRecord} from './inert-record.mjs';
// This boundary validates an attestation against an exact request.
// It does not grant VERIFIED status or persist any certificate.
const digest=x=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
const fields=['theorem_revision','theorem_content_hash','proof_revision','proof_content_hash','context_hash'];
export function assessKernelResult(request,result,authenticate) {
 request=inertRecord(request);result=inertRecord(result);
 if (!request||request.schema_version!=='kg.verify-request.v1'||request.requested_status!=='PENDING'||!fields.every(k=>digest(request[k]))) throw Error('invalid request');
 if (!result||typeof result!=='object'||Array.isArray(result)||Object.getPrototypeOf(result)!==Object.prototype) throw Error('invalid kernel result');
 if (Object.keys(result).some(k=>![...fields,'schema_version','verdict','kernel_id','kernel_version','attestation'].includes(k))) throw Error('unexpected result field');
 if(result.schema_version!=='kg.kernel-result.v1'||!['PASS','FAIL','INDETERMINATE'].includes(result.verdict)||typeof result.kernel_id!=='string'||!result.kernel_id||typeof result.kernel_version!=='string'||!result.kernel_version) throw Error('invalid kernel result');
 if(!fields.every(k=>result[k]===request[k])) throw Error('verification binding mismatch');
 if(typeof authenticate!=='function'||authenticate(result)!==true) throw Error('untrusted kernel result');
 return Object.freeze({schema_version:'kg.assessment.v1',verdict:result.verdict,trust:'AUTHENTICATED_RESULT_ONLY',theorem_revision:request.theorem_revision,proof_revision:request.proof_revision,context_hash:request.context_hash,kernel_id:result.kernel_id,kernel_version:result.kernel_version});
}
