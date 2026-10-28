// This is a trace-model checker, not an authenticated controller or VM launcher.
import {createHash} from 'node:crypto';
export const FIXED_LIMITS=Object.freeze({wallMs:2000,stdoutMaxBytes:128,stderrMaxBytes:0,maxLaunches:1,heapMiB:32,jobMemoryMiB:256,jobCpuMs:1000,jobActiveProcesses:1,monitorPeriodMs:100,maxObservationGapMs:250,postExitObservationMs:1000});
const sha=b=>createHash('sha256').update(b).digest('hex');
const MARKER='MATH_UNIVERSE_PROCESS_ONLY_V1\n';
const hex=(s,n)=>typeof s==='string'&&new RegExp('^[0-9a-f]{'+n+'}$').test(s);
const need=x=>{if(!x)throw Error('MODEL_BLOCKED');};
const exact=(r,keys)=>need(r!==null&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join('|')===[...keys].sort().join('|'));
const base=()=>({evidenceOrigin:'MODEL_ONLY',physicalRuntime:'NOT_RUN',attestation:'NONE',adminit:'SECURITY_HOLD',phase2:'BLOCKED',g1:'BLOCKED',production:'NO_GO',q01:'OPEN',bookGate:'CLOSED',authority:'NONE',admission:'BLOCKED',localExecute:false,isolationConfirmed:false});
export function lockedRuntimeReport(){return{...base(),evidenceOrigin:'PREPARATION_ONLY',stage:'CONTROLLER_UNAVAILABLE',status:'BLOCKED',avState:'NOT_OBSERVED',stopEnforced:false};}
export function evaluateModelTrace(events,expected,manifest){let stage='SCHEMA';try{
 exact(expected,['sourceHead','sourceTree','nodeSha256','payloadSha256','limitsHash']);
 need(hex(expected.sourceHead,40)&&hex(expected.sourceTree,40)&&hex(expected.nodeSha256,64)&&hex(expected.payloadSha256,64)&&hex(expected.limitsHash,64));
 need(manifest.preparationOnly===true&&manifest.hostControllerImplemented===false&&manifest.maxLaunches===1&&JSON.stringify(manifest.limits)===JSON.stringify(FIXED_LIMITS)&&sha(JSON.stringify(FIXED_LIMITS))===manifest.limitsHash&&manifest.limitsHash===expected.limitsHash&&manifest.payloadSha256===expected.payloadSha256);
 need(manifest.schema==='math.disposable-vm-process-smoke.v1'&&manifest.stdoutBytes===Buffer.byteLength(MARKER)&&manifest.stdoutSha256===sha(MARKER));
 need(Array.isArray(events)&&events.length>0&&events.length<=128);
 let admitted=false,health=null,started=null,exited=null,reaped=false,output=0,previous=-1;
 for(let i=0;i<events.length;i++){
  stage='SCHEMA';
  const e=events[i];need(e&&typeof e==='object');const fields={ADMISSION:['sourceHead','sourceTree','nodeSha256','payloadSha256','limitsHash'],HEALTH:['av','isolation','observer','resources'],STARTED:[],OUTPUT:['stream','bytes'],EXIT:['code','stdoutSha256'],REAPED:['remaining']};
  need(Object.hasOwn(fields,e.type));exact(e,['seq','t','type',...fields[e.type]]);
  stage='OBSERVATION_GAP';need(e.seq===i&&Number.isSafeInteger(e.t)&&e.t>=0&&e.t>=previous&&e.t<=3500);previous=e.t;
  if(health!==null){need(e.t-health<=FIXED_LIMITS.maxObservationGapMs);stage='MONITOR_LATE';need(e.t-health<=FIXED_LIMITS.monitorPeriodMs);}
  if(started!==null&&exited===null){stage='TIMEOUT';need(e.t-started<=FIXED_LIMITS.wallMs);}
  if(e.type==='ADMISSION'){
   stage='SOURCE_BINDING';need(i===0&&!admitted&&e.t===0);for(const key of Object.keys(expected))need(e[key]===expected[key]);admitted=true;
  }else if(e.type==='HEALTH'){
   stage='AV_ALERT';need(e.av!=='ALERT');stage='MONITOR_LOST';need(admitted&&e.observer==='LIVE');stage='AV_UNKNOWN';need(e.av==='CLEAR');stage='ISOLATION_UNCONFIRMED';need(e.isolation==='INTACT');stage='RESOURCE_UNCONFIRMED';need(e.resources==='BOUND');health=e.t;
  }else if(e.type==='STARTED'){
   stage='LAUNCH_LIMIT';need(admitted&&health!==null&&started===null&&e.t-health<=FIXED_LIMITS.maxObservationGapMs);started=e.t;
  }else if(e.type==='OUTPUT'){
   stage='OUTPUT_LIMIT';need(started!==null&&exited===null&&['STDOUT','STDERR'].includes(e.stream)&&Number.isSafeInteger(e.bytes)&&e.bytes>=0);if(e.stream==='STDERR')need(e.bytes===0);else{output+=e.bytes;need(output<=FIXED_LIMITS.stdoutMaxBytes);}
  }else if(e.type==='EXIT'){
   stage='CHILD_EXIT';need(started!==null&&exited===null&&e.code===0&&output===manifest.stdoutBytes&&e.stdoutSha256===manifest.stdoutSha256);exited=e.t;
  }else if(e.type==='REAPED'){
   stage='REAP_UNCONFIRMED';need(exited!==null&&!reaped&&e.remaining===0);reaped=true;
  }
 }
 stage='FINAL_COVERAGE';need(exited!==null&&reaped&&health!==null&&health-exited>=FIXED_LIMITS.postExitObservationMs);
 return{...base(),decision:'MODEL_SEQUENCE_ACCEPTABLE',stage:'MODEL_COMPLETE',stopRequested:false,stopEnforced:false};
}catch{return{...base(),decision:'STOP',stage,stopRequested:true,stopEnforced:false};}}
