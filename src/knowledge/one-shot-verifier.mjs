// Experimental v2 one-shot verifier. Never assigns VERIFIED.
import {randomBytes,createPublicKey,verify} from 'node:crypto';
const dig=x=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
const fields=['schema_version','verdict','kernel_id','kernel_version','request_id','theorem_revision','theorem_content_hash','proof_revision','proof_content_hash','context_hash'];
const canon=x=>JSON.stringify(Object.fromEntries(fields.map(k=>[k,x[k]])));
export function createVerificationRequestV2(v1) {
 if(!v1||v1.schema_version!=='kg.verify-request.v1'||v1.requested_status!=='PENDING'||!fields.slice(5).every(k=>dig(v1[k]))) throw Error('invalid v1 request');
 return Object.freeze({...v1,schema_version:'kg.verify-request.v2',request_id:randomBytes(32).toString('hex')});
}
export class OneShotKernelVerifier {
 #used=new Set(); #key; #id; #version;
 constructor({public_key_pem,kernel_id,kernel_version}) {
  this.#key=createPublicKey(public_key_pem);
  if(this.#key.asymmetricKeyType!=='ed25519'||!kernel_id||!kernel_version) throw Error('invalid trust policy');
  this.#id=kernel_id;this.#version=kernel_version;
 }
 assess(request,result) {
  if(!request||request.schema_version!=='kg.verify-request.v2'||!(/^[a-f0-9]{64}$/.test(request.request_id))||!fields.slice(5).every(k=>dig(request[k]))) throw Error('invalid request');
  if(this.#used.has(request.request_id)) throw Error('replayed request');
  if(!result||Object.getPrototypeOf(result)!==Object.prototype||Object.keys(result).some(k=>![...fields,'attestation'].includes(k))) throw Error('invalid result');
  if(result.schema_version!=='kg.kernel-result.v2'||!['PASS','FAIL','INDETERMINATE'].includes(result.verdict)||result.kernel_id!==this.#id||result.kernel_version!==this.#version||result.request_id!==request.request_id||!fields.slice(5).every(k=>result[k]===request[k])) throw Error('result binding mismatch');
  if(typeof result.attestation!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(result.attestation)) throw Error('invalid signature');
  const signature=Buffer.from(result.attestation,'base64');
  if(signature.length!==64||signature.toString('base64')!==result.attestation||!verify(null,Buffer.from(canon(result)),this.#key,signature)) throw Error('untrusted result');
  this.#used.add(request.request_id);
  return Object.freeze({verdict:result.verdict,request_id:request.request_id,trust:'AUTHENTICATED_RESULT_ONLY'});
 }
}
