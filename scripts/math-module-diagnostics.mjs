// Public diagnostic metadata only; never a readiness assertion or evidence waiver.
const errorCodes=new Set(['ERR_TEST_FAILURE','ERR_ASSERTION','EPERM','EBUSY','EACCES','ENOENT','ETIMEDOUT','ECONNREFUSED','ECONNRESET','EADDRINUSE','ERR_UNSUPPORTED_ESM_URL_SCHEME','ERR_MODULE_NOT_FOUND','ERR_UNKNOWN_FILE_EXTENSION']);
const failureTypes=new Map([['hookFailed','HOOK_FAILED'],['testCodeFailure','TEST_CODE_FAILURE'],['cancelledByParent','CANCELLED_BY_PARENT'],['subtestsFailed','SUBTESTS_FAILED'],['testTimeoutFailure','TIMEOUT']]);
const startupCodes=new Set(['CHILD_READY','CHILD_EXIT_ZERO_WITHOUT_READY','CHILD_ENGINE_REJECTED','CHILD_IMPORT_SCHEME_REJECTED','CHILD_MODULE_NOT_FOUND','CHILD_ADDRESS_IN_USE','CHILD_EXIT_ONE_OTHER','CHILD_EXIT_OTHER','CHILD_NO_EXIT_CODE','STARTUP_DEADLINE','LAUNCH_NOT_FOUND','LAUNCH_ACCESS_DENIED','LAUNCH_ERROR_OTHER']);
function ownValue(object,key){try{const descriptor=Object.getOwnPropertyDescriptor(object,key);return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;}catch{return undefined;}}
export function publicErrorCode(error){
 let result='UNCLASSIFIED';
 for(let depth=0;depth<4&&error&&typeof error==='object';depth++){
  const code=ownValue(error,'code');if(errorCodes.has(code))result=code;
  error=ownValue(error,'cause');
 }
 return result;
}
export const publicFailureType=value=>failureTypes.get(value&&typeof value==='object'?ownValue(value,'failureType'):value)??'UNCLASSIFIED';
export const admittedErrorCode=value=>errorCodes.has(value)?value:'UNCLASSIFIED';
export const admittedFailureType=value=>[...failureTypes.values()].includes(value)?value:'UNCLASSIFIED';
export function startupCode(result,error=null){
 if(error){const message=ownValue(error,'message'),code=ownValue(error,'code');if(message==='bounded startup deadline')return 'STARTUP_DEADLINE';if(code==='ENOENT')return 'LAUNCH_NOT_FOUND';if(code==='EACCES')return 'LAUNCH_ACCESS_DENIED';return 'LAUNCH_ERROR_OTHER';}
 const port=ownValue(result,'port'),code=ownValue(result,'code');
 if(Number.isSafeInteger(port)&&port>0)return 'CHILD_READY';
 if(code===0)return 'CHILD_EXIT_ZERO_WITHOUT_READY';
 if(code===1){
  const stderr=ownValue(result,'stderr'),text=typeof stderr==='string'?stderr.slice(0,4096):'';
  if(text.trim()==='MATH_ENGINE_STARTUP_REJECTED')return 'CHILD_ENGINE_REJECTED';
  if(/^[A-Za-z]*Error \[ERR_UNSUPPORTED_ESM_URL_SCHEME\]:/m.test(text))return 'CHILD_IMPORT_SCHEME_REJECTED';
  if(/^[A-Za-z]*Error \[ERR_MODULE_NOT_FOUND\]:/m.test(text))return 'CHILD_MODULE_NOT_FOUND';
  if(/^Error: listen EADDRINUSE:/m.test(text))return 'CHILD_ADDRESS_IN_USE';
  return 'CHILD_EXIT_ONE_OTHER';
 }
 return Number.isInteger(code)?'CHILD_EXIT_OTHER':'CHILD_NO_EXIT_CODE';
}
export function fixtureCode(message){
 if(typeof message!=='string'||message.length>96)return null;
 const match=message.match(/^MATH_MODULE_FIXTURE code=([A-Z0-9_]+)$/);
 return match&&startupCodes.has(match[1])?match[1]:null;
}
