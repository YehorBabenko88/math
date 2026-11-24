import{readFileSync,lstatSync}from'node:fs';import{resolve,join,dirname}from'node:path';import{fileURLToPath}from'node:url';
const cases=['normal','timeout','crash','assignment','cleanup'];
function check(ok,why){if(!ok)throw Error('Native evidence BLOCKED: '+why);}
const handle=x=>x&&Number.isSafeInteger(x.pid)&&x.pid>0&&typeof x.createdFileTime==='string'&&/^[1-9][0-9]{15,19}$/.test(x.createdFileTime)&&typeof x.handle==='string'&&/^[1-9a-f][0-9a-f]*$/.test(x.handle)&&x.signalled===true;
export function validateForcedWatchdogProbe(p){
 check(p?.scenario==='watchdog'&&p.status==='BLOCKED'&&p.reason==='forced independent owner watchdog expired','forced watchdog outcome, never PASS');
 check(p.waitResult===258&&p.liveBeforeExpiry===true&&p.outerCleanupConfirmed===true&&p.leafAssignedBeforeResume===true,'forced watchdog readiness/expiry/drain');
 check(handle(p.owner)&&handle(p.root)&&handle(p.leaf)&&new Set([p.owner.pid,p.root.pid,p.leaf.pid]).size===3&&new Set([p.owner.handle,p.root.handle,p.leaf.handle]).size===3,'forced watchdog process handle proof');
 return Object.freeze({status:'BLOCKED',negativeProbeVerified:true,scope:'forced expiry is not native qualification PASS'});
}
export function validateNativeReport(r,{sourceHead,sourceTree}={}){
 validateForcedWatchdogProbe(r?.watchdogProbe);
 check(/^[a-f0-9]{40}$/.test(sourceHead??'')&&/^[a-f0-9]{40}$/.test(sourceTree??''),'external source identity');
 check(r?.sourceHead===sourceHead&&r.sourceTree===sourceTree&&r.token==='non-elevated Medium'&&r.localExecution==='BLOCKED_PENDING_ISOLATION_REVIEW','source/token/local policy');
 check(r.tokenEvidence?.elevation===0&&r.tokenEvidence.integrityRid===8192&&/^S-1-5-[0-9-]+$/.test(r.tokenEvidence.userSid??'')&&Number.isSafeInteger(r.tokenEvidence.pid)&&r.tokenEvidence.pid>0,'measured token evidence');
 const lab=r.labEvidence,user=r.tokenEvidence.userSid;check(lab?.ownerSid===user&&Array.isArray(lab.writableSids)&&lab.writableSids.includes(user)&&new Set(lab.writableSids).size===lab.writableSids.length&&lab.writableSids.every(s=>[user,'S-1-5-18','S-1-5-32-544'].includes(s))&&typeof lab.sddlSha256==='string'&&/^[a-f0-9]{64}$/.test(lab.sddlSha256),'measured lab ACL evidence');
 for(const key of ['results','evidence'])check(Array.isArray(r[key])&&r[key].length===cases.length&&new Set(r[key].map(x=>x?.scenario)).size===cases.length&&r[key].every(x=>cases.includes(x?.scenario)),'exact '+key+' inventory');
 for(const e of r.evidence)check(e.outerCleanupConfirmed===true&&Number.isSafeInteger(e.elapsedMs)&&e.elapsedMs>=0&&e.elapsedMs<35000,'outer cleanup/deadline');
 for(const c of r.results){
  check(c.status==='PASS','scenario failure');
  if(c.scenario==='crash'){check(handle(c.owner)&&handle(c.root)&&handle(c.leaf)&&new Set([c.owner.pid,c.root.pid,c.leaf.pid]).size===3&&c.innerJobHandleHeldByObserver===false&&c.leafAssignedBeforeResume===true,'owner crash process-handle proof');continue;}
  const h=c.handles;check(handle(h?.root),'root identity');
  check(Array.isArray(h.calls)&&h.calls.indexOf('create-job')>=0&&h.calls.indexOf('create-job')<h.calls.indexOf('kill-on-close')&&h.calls.indexOf('kill-on-close')<h.calls.indexOf('create-suspended')&&h.calls.indexOf('create-suspended')<h.calls.indexOf('assign'),'suspended assignment ordering');
  if(c.scenario==='assignment')check(h.leaf===null&&h.assigned===false&&h.resumed===false&&!h.calls.includes('resume')&&h.calls.includes('terminate-process')&&Number.isSafeInteger(h.nativeAssignmentError)&&h.nativeAssignmentError>0,'assignment fail-closed');
  else check(handle(h.leaf)&&h.leaf.pid!==h.root.pid&&h.assigned===true&&h.resumed===true&&h.drained===true&&h.leafAssignedBeforeResume===true&&h.calls.indexOf('assign')<h.calls.indexOf('resume')&&h.calls.indexOf('resume')<h.calls.indexOf('terminate-job')&&h.calls.indexOf('terminate-job')<h.calls.indexOf('drain=True'),'child handle/drain proof');
  if(c.scenario==='cleanup')check(h.drainRejected===true&&/job drain unconfirmed/.test(c.error??''),'cleanup rejection proof');
  if(c.scenario==='timeout')check(/deadline/.test(c.error??''),'timeout proof');
 }
 return {status:'PASS',validationScope:'PRODUCER_LOCAL_SCHEMA_ONLY',independentAcceptance:'BLOCKED_PRIVATE_EVIDENCE_REQUIRED',cases:cases.length,forcedWatchdogStatus:'BLOCKED',negativeWatchdogProofVerified:true,localExecution:'BLOCKED_PENDING_ISOLATION_REVIEW',scope:'hosted fixed synthetic mechanisms only; not filesystem/network isolation or physical authorization'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{check(process.argv.length===5,'DIRECTORY SOURCE_HEAD SOURCE_TREE required');const dir=resolve(process.argv[2]);for(let p=dir;;p=dirname(p)){check(!lstatSync(p).isSymbolicLink(),'reparse directory');if(dirname(p)===p)break;}const file=join(dir,'results.json'),s=lstatSync(file);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=1048576,'regular bounded report');const report=JSON.parse(readFileSync(file,'utf8'));validateForcedWatchdogProbe(report.watchdogProbe);console.log(JSON.stringify(validateNativeReport(report,{sourceHead:process.argv[3],sourceTree:process.argv[4]})));}catch(e){console.error('Native evidence verification BLOCKED; payload suppressed');process.exitCode=2;}
}
