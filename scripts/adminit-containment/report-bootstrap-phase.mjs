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
const UI_RIGHTS=Object.freeze(['WINSTA_ENUM_DESKTOPS','WINSTA_READ_ATTRIBUTES','WINSTA_ACCESS_CLIPBOARD','WINSTA_CREATE_DESKTOP','WINSTA_WRITE_ATTRIBUTES','WINSTA_ACCESS_GLOBAL_ATOMS','WINSTA_EXIT_WINDOWS','WINSTA_ENUMERATE','WINSTA_READ_SCREEN','WINSTA_GENERIC_ALL','DESKTOP_READ_OBJECTS','DESKTOP_CREATE_WINDOW','DESKTOP_CREATE_MENU','DESKTOP_HOOK_CONTROL','DESKTOP_JOURNAL_RECORD','DESKTOP_JOURNAL_PLAYBACK','DESKTOP_ENUMERATE','DESKTOP_WRITE_OBJECTS','DESKTOP_SWITCH','DESKTOP_GENERIC_ALL']);
const UI_FAILURES=Object.freeze([...ACCESS_FAILURES,'HANDLE_UNAVAILABLE','STATION_KIND_UNAVAILABLE','UNSUPPORTED_RIGHT']);
const UI_LABEL_FAILURES=Object.freeze([...UI_FAILURES,'LABEL_UNAVAILABLE','LABEL_BOUNDS']);
const UI_LABELS=Object.freeze(['LOW','MEDIUM','HIGH','SYSTEM','UNLABELLED','OTHER']);
export function bootstrapUiDiagnostics(text){
 const empty=()=>({station:'UNKNOWN',rights:[],labels:[]});
 if(typeof text!=='string'||Buffer.byteLength(text)>16384)return empty();
 let station='UNKNOWN';const rights=new Map(),labels=new Map();
 for(const [,value] of text.matchAll(/^HOSTED_UI_CONTEXT station=([A-Z_]+)\r?$/gm)){
  if(station!=='UNKNOWN'||!['INTERACTIVE','NONINTERACTIVE','UNAVAILABLE'].includes(value))return empty();station=value;
 }
 for(const [,name,available,allowed,failureClass] of text.matchAll(/^HOSTED_UI_ACCESS_PROBE name=([A-Z_]+) available=(true|false) allowed=(true|false) class=([A-Z_]+)\r?$/gm)){
  if(!UI_RIGHTS.includes(name)||rights.has(name)||(available==='true'?failureClass!=='NONE':allowed!=='false'||!UI_FAILURES.includes(failureClass)))return empty();
  rights.set(name,{name,available:available==='true',allowed:allowed==='true',failureClass});
 }
 for(const [,name,available,label,write,read,execute,failureClass] of text.matchAll(/^HOSTED_UI_LABEL name=([A-Z_]+) available=(true|false) label=([A-Z_]+) no_write_up=(true|false) no_read_up=(true|false) no_execute_up=(true|false) class=([A-Z_]+)\r?$/gm)){
  if(!['WINDOW_STATION','DESKTOP'].includes(name)||labels.has(name))return empty();
  const policyPresent=write==='true'||read==='true'||execute==='true';
  if(available==='true'?failureClass!=='NONE'||!UI_LABELS.includes(label)||(label==='UNLABELLED'&&policyPresent):label!=='UNAVAILABLE'||policyPresent||!UI_LABEL_FAILURES.includes(failureClass))return empty();
  labels.set(name,{name,available:available==='true',label,noWriteUp:write==='true',noReadUp:read==='true',noExecuteUp:execute==='true',failureClass});
 }
 return {station,rights:UI_RIGHTS.filter(name=>rights.has(name)).map(name=>rights.get(name)),labels:['WINDOW_STATION','DESKTOP'].filter(name=>labels.has(name)).map(name=>labels.get(name))};
}
const JOB_UI_NAMES=Object.freeze(['HANDLES','READ_CLIPBOARD','WRITE_CLIPBOARD','SYSTEM_PARAMETERS','DISPLAY_SETTINGS','GLOBAL_ATOMS','DESKTOP','EXIT_WINDOWS']);
const POLICY_NAMES=Object.freeze(['OWNED_JOB_UI_','CALLER_IMMEDIATE_JOB_UI_'].flatMap(prefix=>JOB_UI_NAMES.map(name=>prefix+name)).concat(['CHILD_WIN32K_DISABLED','CHILD_WIN32K_AUDIT']));
const POLICY_FAILURES=Object.freeze(['QUERY_UNAVAILABLE','NO_CALLER_JOB','HANDLE_UNAVAILABLE','SIZE_BOUNDS','UNSUPPORTED_POLICY_FLAGS']);
const KERNEL_RIGHTS=Object.freeze(['CHILD_PROCESS_QUERY','CHILD_PROCESS_QUERY_LIMITED','CHILD_PROCESS_VM_READ','CHILD_PROCESS_SYNCHRONIZE','CHILD_THREAD_QUERY','CHILD_THREAD_GET_CONTEXT','CHILD_THREAD_SYNCHRONIZE']);
const KERNEL_FAILURES=Object.freeze([...UI_FAILURES,'UNMAPPED_GENERIC_ACE','UNSUPPORTED_ACE']);
export function bootstrapKernelDiagnostics(text){
 const empty=()=>({policies:[],rights:[],labels:[]});
 if(typeof text!=='string'||Buffer.byteLength(text)>16384)return empty();
 const policies=new Map(),rights=new Map(),labels=new Map();
 for(const [,name,available,enabled,failureClass] of text.matchAll(/^HOSTED_POLICY_PROBE name=([A-Z0-9_]+) available=(true|false) enabled=(true|false) class=([A-Z_]+)\r?$/gm)){
  if(!POLICY_NAMES.includes(name)||policies.has(name)||(available==='true'?failureClass!=='NONE':enabled!=='false'||!POLICY_FAILURES.includes(failureClass))||(failureClass==='NO_CALLER_JOB'&&!name.startsWith('CALLER_IMMEDIATE_JOB_UI_')))return empty();
  policies.set(name,{name,available:available==='true',enabled:enabled==='true',failureClass});
 }
 for(const [,name,available,allowed,failureClass] of text.matchAll(/^HOSTED_KERNEL_ACCESS_PROBE name=([A-Z_]+) available=(true|false) allowed=(true|false) class=([A-Z_]+)\r?$/gm)){
  if(!KERNEL_RIGHTS.includes(name)||rights.has(name)||(available==='true'?failureClass!=='NONE':allowed!=='false'||!KERNEL_FAILURES.includes(failureClass)))return empty();
  rights.set(name,{name,available:available==='true',allowed:allowed==='true',failureClass});
 }
 for(const [,name,available,label,write,read,execute,failureClass] of text.matchAll(/^HOSTED_KERNEL_LABEL name=([A-Z_]+) available=(true|false) label=([A-Z_]+) no_write_up=(true|false) no_read_up=(true|false) no_execute_up=(true|false) class=([A-Z_]+)\r?$/gm)){
  if(!['CHILD_PROCESS','CHILD_THREAD'].includes(name)||labels.has(name))return empty();
  const policyPresent=write==='true'||read==='true'||execute==='true';
  if(available==='true'?failureClass!=='NONE'||!UI_LABELS.includes(label)||(label==='UNLABELLED'&&policyPresent):label!=='UNAVAILABLE'||policyPresent||!UI_LABEL_FAILURES.includes(failureClass))return empty();
  labels.set(name,{name,available:available==='true',label,noWriteUp:write==='true',noReadUp:read==='true',noExecuteUp:execute==='true',failureClass});
 }
 return {policies:POLICY_NAMES.filter(name=>policies.has(name)).map(name=>policies.get(name)),rights:KERNEL_RIGHTS.filter(name=>rights.has(name)).map(name=>rights.get(name)),labels:['CHILD_PROCESS','CHILD_THREAD'].filter(name=>labels.has(name)).map(name=>labels.get(name))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let phase='UNKNOWN',fd;
 let childClass='UNKNOWN';
 let accessChecks=[];
 let ui=bootstrapUiDiagnostics('');
 let kernel=bootstrapKernelDiagnostics('');
 try{
  if(process.argv.length!==3)throw Error();fd=openSync(process.argv[2],'r');
  const facts=fstatSync(fd);if(!facts.isFile()||facts.size>16384)throw Error();
  const raw=Buffer.alloc(16385),count=readSync(fd,raw,0,raw.length,0);phase=bootstrapPhase(raw.subarray(0,count).toString('utf8'));
  childClass=bootstrapChildClass(raw.subarray(0,count).toString('utf8'));
  accessChecks=bootstrapAccessChecks(raw.subarray(0,count).toString('utf8'));
  ui=bootstrapUiDiagnostics(raw.subarray(0,count).toString('utf8'));
  kernel=bootstrapKernelDiagnostics(raw.subarray(0,count).toString('utf8'));
 }catch{}finally{if(fd!==undefined)try{closeSync(fd);}catch{phase='UNKNOWN';}}
 console.log('HOSTED_BOOTSTRAP_FAILURE phase='+phase);
 if(childClass!=='UNKNOWN')console.log('HOSTED_CHILD_FAILURE class='+childClass);
 for(const check of accessChecks)console.log('HOSTED_ACCESS_PROBE name='+check.name+' available='+check.available+' allowed='+check.allowed+' class='+check.failureClass);
 if(ui.station!=='UNKNOWN')console.log('HOSTED_UI_CONTEXT station='+ui.station);
 for(const check of ui.rights)console.log('HOSTED_UI_ACCESS_PROBE name='+check.name+' available='+check.available+' allowed='+check.allowed+' class='+check.failureClass);
 for(const label of ui.labels)console.log('HOSTED_UI_LABEL name='+label.name+' available='+label.available+' label='+label.label+' no_write_up='+label.noWriteUp+' no_read_up='+label.noReadUp+' no_execute_up='+label.noExecuteUp+' class='+label.failureClass);
 for(const value of kernel.policies)console.log('HOSTED_POLICY_PROBE name='+value.name+' available='+value.available+' enabled='+value.enabled+' class='+value.failureClass);
 for(const value of kernel.rights)console.log('HOSTED_KERNEL_ACCESS_PROBE name='+value.name+' available='+value.available+' allowed='+value.allowed+' class='+value.failureClass);
 for(const value of kernel.labels)console.log('HOSTED_KERNEL_LABEL name='+value.name+' available='+value.available+' label='+value.label+' no_write_up='+value.noWriteUp+' no_read_up='+value.noReadUp+' no_execute_up='+value.noExecuteUp+' class='+value.failureClass);
}
