// Offline artifact-byte verification. A matching digest proves integrity only, not origin.
import {createHash,timingSafeEqual} from 'node:crypto';
const hex=/^[0-9a-f]{64}$/;
export function sha256(bytes){
 if(!(bytes instanceof Uint8Array))throw Error('INVALID_BYTES');
 return createHash('sha256').update(bytes).digest('hex');
}
export function verifyArtifact(bytes,expected){
 if(typeof expected!=='string'||!hex.test(expected))throw Error('INVALID_DIGEST');
 const actual=sha256(bytes);
 if(!timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex')))throw Error('DIGEST_MISMATCH');
 return Object.freeze({sha256:actual,integrity:'MATCHED',provenance:'UNATTESTED'});
}
export function verifyReceiptOutput(receipt,bytes){
 if(receipt===null||typeof receipt!=='object'||Array.isArray(receipt))throw Error('INVALID_RECEIPT');
 return verifyArtifact(bytes,receipt.outputHash);
}
