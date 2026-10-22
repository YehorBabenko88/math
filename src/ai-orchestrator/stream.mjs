// Offline bounded streaming integrity verifier. Never executes or authenticates artifacts.
import {createHash,timingSafeEqual} from 'node:crypto';
const hex=/^[0-9a-f]{64}$/;
export async function verifyArtifactStream(chunks,expected,{maxBytes}={}){
 if(typeof expected!=='string'||!hex.test(expected))throw Error('INVALID_DIGEST');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<0||maxBytes>50*1024*1024)throw Error('INVALID_LIMIT');
 if(chunks==null||typeof chunks[Symbol.asyncIterator]!=='function')throw Error('INVALID_STREAM');
 const hash=createHash('sha256');
 let count=0;
 for await(const chunk of chunks){
  if(!(chunk instanceof Uint8Array))throw Error('INVALID_CHUNK');
  if(chunk.byteLength>maxBytes-count)throw Error('ACTUAL_OUTPUT_BUDGET_EXCEEDED');
  count+=chunk.byteLength;
  hash.update(chunk);
 }
 const actual=hash.digest();
 if(!timingSafeEqual(actual,Buffer.from(expected,'hex')))throw Error('DIGEST_MISMATCH');
 return Object.freeze({sha256:actual.toString('hex'),bytes:count,integrity:'MATCHED',provenance:'UNATTESTED'});
}
