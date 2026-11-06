// NON_QUALIFYING closed public witness. Imports have no native/process side effects.
import {spawnSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const keys=['schema','head','tree','qualification','nativeAcceptance','outcome','events','breakpointHandled','firstException','lastModule','cleanup'];
const outcomes=['UNAVAILABLE','DEADLINE','EVENT_LIMIT','PROTOCOL_FAILURE','DLL_INITIALIZATION_FAILED','DLL_NOT_FOUND','INVALID_IMAGE_FORMAT','OTHER_EXIT','DEBUGGER_PERTURBED_BASELINE','CLEANUP_UNCONFIRMED'];
const exceptions=['NONE','ACCESS_VIOLATION','DLL_INITIALIZATION_FAILED','DLL_NOT_FOUND','INVALID_IMAGE_FORMAT','BREAKPOINT','OTHER'];
const modules=['NONE','OS_NTDLL','OS_KERNEL32','OS_KERNELBASE','OS_USER32','OS_WIN32U','OTHER','UNAVAILABLE'];
const reject=()=>{throw new Error('TRACE_REJECTED');};
export function parseTrace(raw,identity) {
  if(typeof raw!=='string'||Buffer.byteLength(raw)>8192||!/^[0-9a-f]{40}$/.test(identity?.head??'')||!/^[0-9a-f]{40}$/.test(identity?.tree??''))reject();
  let v;try{v=JSON.parse(raw);}catch{reject();}
  if(!v||Array.isArray(v)||Object.keys(v).join(',')!==keys.join(',')||raw!==JSON.stringify(v)+'\n')reject();
  if(v.schema!=='math.loader-init-trace.v1'||v.head!==identity.head||v.tree!==identity.tree||v.qualification!=='NONE'||v.nativeAcceptance!=='BLOCKED'||!outcomes.includes(v.outcome)||!Number.isSafeInteger(v.events)||v.events<0||v.events>256||typeof v.breakpointHandled!=='boolean'||!exceptions.includes(v.firstException)||!modules.includes(v.lastModule)||!['CONFIRMED','UNCONFIRMED'].includes(v.cleanup))reject();
  if((v.cleanup==='UNCONFIRMED')!==(v.outcome==='CLEANUP_UNCONFIRMED'))reject();
  return v;
}
function run() {
  const [build,head,tree]=process.argv.slice(2);
  if(process.argv.length!==5||process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_ENVIRONMENT!=='github-hosted'||process.env.NODE_OPTIONS||process.env.NODE_PATH)reject();
  const root=resolve(build),temp=resolve(process.env.RUNNER_TEMP??'');
  if(!root.toLowerCase().startsWith(temp.toLowerCase()+'\\'))reject();
  const pinPath=join(root,'loader-init-identity.json'),exe=join(root,'HostedLoaderInitTrace.exe');
  if(statSync(pinPath).size>4096||statSync(exe).size>1048576)reject();
  const pin=JSON.parse(readFileSync(pinPath,'utf8'));
  if(pin.head!==head||pin.tree!==tree||!/^[0-9a-f]{64}$/.test(pin.sha256??'')||pin.qualification!=='NONE'||pin.nativeAcceptance!=='BLOCKED')reject();
  const hash=()=>createHash('sha256').update(readFileSync(exe)).digest('hex');
  if(hash()!==pin.sha256)reject();
  const child=spawnSync(exe,[root,head,tree],{encoding:'utf8',timeout:30000,maxBuffer:8192,windowsHide:true});
  if(statSync(exe).size>1048576||hash()!==pin.sha256)reject();
  if(child.error||Buffer.byteLength(child.stdout??'')+Buffer.byteLength(child.stderr??'')>8192||child.stderr||![0,2].includes(child.status))reject();
  const v=parseTrace(child.stdout,{head,tree});
  if((child.status===2)!==(v.cleanup==='UNCONFIRMED'))reject();
  process.stdout.write(JSON.stringify(v)+'\n');process.exitCode=child.status;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)try{run();}catch{process.stderr.write('TRACE_REJECTED qualification=NONE nativeAcceptance=BLOCKED\n');process.exitCode=2;}
