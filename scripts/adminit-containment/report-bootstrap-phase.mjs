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
const CHILD_CLASSES=Object.freeze(['SUCCESS','SCENARIO_FAILURE','MANAGED_GATE_BLOCKED','DLL_INITIALIZATION_FAILED','DLL_NOT_FOUND','INVALID_IMAGE_FORMAT','ACCESS_VIOLATION','CLR_EXCEPTION','OTHER_NONZERO']);
export function bootstrapChildClass(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>16384)return 'UNKNOWN';
 let classification='UNKNOWN';
 for(const [,value] of text.matchAll(/^HOSTED_CHILD_FAILURE class=([A-Z_]+)\r?$/gm))if(CHILD_CLASSES.includes(value))classification=value;
 return classification;
}
const ACCESS_NAMES=Object.freeze(['PACKAGE_EXE_READ_EXECUTE','PACKAGE_ROOT_LIST','RUN_PARENT_CREATE_DIR','RUN_PARENT_TEMP_WRITE']);
const ACCESS_FAILURES=Object.freeze(['PATH_REJECTED','TOKEN_DUPLICATE_FAILED','SECURITY_DESCRIPTOR_UNAVAILABLE','SECURITY_DESCRIPTOR_BOUNDS','ACCESS_CHECK_UNAVAILABLE','RESOURCE_RELEASE_FAILED','PROBE_UNAVAILABLE']);
export function bootstrapAccessChecks(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>16384)return [];
 const checks=new Map();
 for(const [,name,available,allowed,failureClass] of text.matchAll(/^HOSTED_ACCESS_PROBE name=([A-Z_]+) available=(true|false) allowed=(true|false) class=([A-Z_]+)\r?$/gm)){
  if(!ACCESS_NAMES.includes(name)||checks.has(name))return [];
  if(available==='true'?failureClass!=='NONE':allowed!=='false'||!ACCESS_FAILURES.includes(failureClass))return [];
  checks.set(name,{name,available:available==='true',allowed:allowed==='true',failureClass});
 }
 return ACCESS_NAMES.filter(name=>checks.has(name)).map(name=>checks.get(name));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let phase='UNKNOWN',fd;
 let childClass='UNKNOWN';
 let accessChecks=[];
 try{
  if(process.argv.length!==3)throw Error();fd=openSync(process.argv[2],'r');
  const facts=fstatSync(fd);if(!facts.isFile()||facts.size>16384)throw Error();
  const raw=Buffer.alloc(16385),count=readSync(fd,raw,0,raw.length,0);phase=bootstrapPhase(raw.subarray(0,count).toString('utf8'));
  childClass=bootstrapChildClass(raw.subarray(0,count).toString('utf8'));
  accessChecks=bootstrapAccessChecks(raw.subarray(0,count).toString('utf8'));
 }catch{}finally{if(fd!==undefined)try{closeSync(fd);}catch{phase='UNKNOWN';}}
 console.log('HOSTED_BOOTSTRAP_FAILURE phase='+phase);
 if(childClass!=='UNKNOWN')console.log('HOSTED_CHILD_FAILURE class='+childClass);
 for(const check of accessChecks)console.log('HOSTED_ACCESS_PROBE name='+check.name+' available='+check.available+' allowed='+check.allowed+' class='+check.failureClass);
}
