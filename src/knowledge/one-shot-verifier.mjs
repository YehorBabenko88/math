import {inertRecord} from './inert-record.mjs';
import {types} from 'node:util';
// Experimental v2 one-shot verifier. Never assigns VERIFIED.
import {randomBytes,createPublicKey,verify} from 'node:crypto';
import {FileReplayLedger} from './file-replay-ledger.mjs';
const dig=x=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
const fields=['schema_version','verdict','kernel_id','kernel_version','request_id','theorem_revision','theorem_content_hash','proof_revision','proof_content_hash','context_hash'];
const canon=x=>JSON.stringify(Object.fromEntries(fields.map(k=>[k,x[k]])));
export function createVerificationRequestV2(v1) {
 v1=inertRecord(v1);
 const allowed=new Set(['schema_version','requested_status','theorem_revision','theorem_content_hash','proof_revision','proof_content_hash','context_hash']);
 if(Object.keys(v1).some(k=>!allowed.has(k))) throw Error('unexpected request field');
 if(!v1||v1.schema_version!=='kg.verify-request.v1'||v1.requested_status!=='PENDING'||!fields.slice(5).every(k=>dig(v1[k]))) throw Error('invalid v1 request');
 return Object.freeze({...v1,schema_version:'kg.verify-request.v2',request_id:randomBytes(32).toString('hex')});
}
export class OneShotKernelVerifier {
 #key; #id; #version; #consume;
 constructor(config) {
  if(!config||typeof config!=='object'||types.isProxy(config)||Array.isArray(config)||Object.getPrototypeOf(config)!==Object.prototype) throw Error('invalid trust policy');
  const descriptors=Object.getOwnPropertyDescriptors(config);
  if(Reflect.ownKeys(descriptors).some(k=>typeof k!=='string'||!['public_key_pem','kernel_id','kernel_version','ledger'].includes(k)||!Object.hasOwn(descriptors[k],'value'))) throw Error('invalid trust policy');
  const {public_key_pem,kernel_id,kernel_version,ledger}=Object.fromEntries(Object.entries(descriptors).map(([k,d])=>[k,d.value]));
  if(typeof public_key_pem!=='string'||typeof kernel_id!=='string'||!kernel_id||typeof kernel_version!=='string'||!kernel_version) throw Error('invalid trust policy');
  if(!(ledger instanceof FileReplayLedger)) throw Error('trusted FileReplayLedger required');
  this.#consume=FileReplayLedger.prototype.consume.bind(ledger);
  this.#key=createPublicKey(public_key_pem);
  if(this.#key.asymmetricKeyType!=='ed25519'||!kernel_id||!kernel_version) throw Error('invalid trust policy');
  this.#id=kernel_id;this.#version=kernel_version;
 }
 async assessPersisted(request,result) {
  request=inertRecord(request);result=inertRecord(result);
  const assessment=this.#validateSignature(request,result);
  const accepted=await this.#consume(request.request_id);
  if(accepted!==true) throw Error('replayed request');
  return assessment;
 }
 assess() { throw Error('persistent ledger required: use assessPersisted'); }
 #validateSignature(request,result) {
  if(Object.keys(request).some(k=>!['schema_version','requested_status','request_id',...fields.slice(5)].includes(k))) throw Error('unexpected request field');
  if(!request||!['schema_version','requested_status','request_id',...fields.slice(5)].every(k=>Object.hasOwn(request,k))||request.schema_version!=='kg.verify-request.v2'||request.requested_status!=='PENDING'||!(/^[a-f0-9]{64}$/.test(request.request_id))||!fields.slice(5).every(k=>dig(request[k]))) throw Error('invalid request');
  if(!result||Object.getPrototypeOf(result)!==Object.prototype||Object.keys(result).some(k=>![...fields,'attestation'].includes(k))) throw Error('invalid result');
  if(!fields.every(k=>Object.hasOwn(result,k))||!Object.hasOwn(result,'attestation')) throw Error('incomplete result');
  if(result.schema_version!=='kg.kernel-result.v2'||!['PASS','FAIL','INDETERMINATE'].includes(result.verdict)||result.kernel_id!==this.#id||result.kernel_version!==this.#version||result.request_id!==request.request_id||!fields.slice(5).every(k=>result[k]===request[k])) throw Error('result binding mismatch');
  if(typeof result.attestation!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(result.attestation)) throw Error('invalid signature');
  const signature=Buffer.from(result.attestation,'base64');
  if(signature.length!==64||signature.toString('base64')!==result.attestation||!verify(null,Buffer.from(canon(result)),this.#key,signature)) throw Error('untrusted result');
  return Object.freeze({verdict:result.verdict,request_id:request.request_id,trust:'AUTHENTICATED_RESULT_ONLY'});
 }
}
