// Explicit trust policy: no untrusted caller may choose a verification key.
import {createPublicKey,verify} from 'node:crypto';
const fields=['schema_version','verdict','kernel_id','kernel_version','theorem_revision','theorem_content_hash','proof_revision','proof_content_hash','context_hash'];
const canonical = result => JSON.stringify(Object.fromEntries(fields.map(k=>[k,result[k]])));
export function createEd25519KernelAuthenticator(config) {
 if(!config||typeof config!=='object'||typeof config.kernel_id!=='string'||!config.kernel_id||typeof config.kernel_version!=='string'||!config.kernel_version||typeof config.public_key_pem!=='string') throw Error('invalid trust policy');
 const key=createPublicKey(config.public_key_pem);
 if(key.asymmetricKeyType!=='ed25519') throw Error('Ed25519 key required');
 const kernelId=config.kernel_id,kernelVersion=config.kernel_version;
 return result => {
  if(!result||result.kernel_id!==kernelId||result.kernel_version!==kernelVersion||typeof result.attestation!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(result.attestation)) return false;
  const signature=Buffer.from(result.attestation,'base64');
  if(signature.length!==64||signature.toString('base64')!==result.attestation) return false;
  return verify(null,Buffer.from(canonical(result),'utf8'),key,signature);
 };
}
