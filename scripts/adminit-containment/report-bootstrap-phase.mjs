// Public classification only. Raw bootstrap streams remain private.
import {openSync,readSync,closeSync,fstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const BOOTSTRAP_PHASES=Object.freeze(['HOSTED_GUARD','ROOTS','TOKEN_QUERY','TOKEN_CREATE','INTEGRITY_SID','INTEGRITY_ASSIGN','ENVIRONMENT','JOB_CREATE','JOB_CONFIGURE','PROCESS_CREATE','JOB_ASSIGN','THREAD_RESUME','PROCESS_WAIT','CHILD_RESULT','CLEANUP']);
export function bootstrapPhase(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>16384)return 'UNKNOWN';
 let phase='UNKNOWN';
 for(const [,value] of text.matchAll(/^HOSTED_BOOTSTRAP_PHASE=([A-Z_]+)\r?$/gm))if(BOOTSTRAP_PHASES.includes(value))phase=value;
 return phase;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let phase='UNKNOWN',fd;
 try{
  if(process.argv.length!==3)throw Error();fd=openSync(process.argv[2],'r');
  const facts=fstatSync(fd);if(!facts.isFile()||facts.size>16384)throw Error();
  const raw=Buffer.alloc(16385),count=readSync(fd,raw,0,raw.length,0);phase=bootstrapPhase(raw.subarray(0,count).toString('utf8'));
 }catch{}finally{if(fd!==undefined)try{closeSync(fd);}catch{phase='UNKNOWN';}}
 console.log('HOSTED_BOOTSTRAP_FAILURE phase='+phase);
}
