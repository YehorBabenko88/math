import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {strictJson,exact,need,blocked} from '../../src/evidence-receiver/strict.mjs';
// Observations, never admission authority. No filesystem or network access.
export function auditG0Snapshot(text,{now=Date.now()}={}) {
 try {
  need(typeof text==='string'&&Buffer.byteLength(text)<=16384&&Number.isSafeInteger(now));
  const s=strictJson(text,16384);
  exact(s,['schema','observedAt','readOnly','rootScope','checks','network','protectedServicesContacted','authority','localExecute']);
  need(s.schema==='math.adminit.g0-observation.v1'&&s.readOnly===true&&s.rootScope==='SEPARATE_NEW_ROOT'&&s.protectedServicesContacted===false&&s.authority==='NONE'&&s.localExecute===false);
  need(typeof s.observedAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/.test(s.observedAt));
  const parsed=Date.parse(s.observedAt);need(Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,19)===s.observedAt.slice(0,19));
  const age=now-parsed;need(Number.isFinite(age)&&age>=0&&age<=300000);
  exact(s.checks,['path','acl','token','firewall']);
  need(Object.values(s.checks).every(x=>['PASS','FAIL','UNKNOWN'].includes(x)));
  exact(s.network,['activeProfiles','applicableRules','effectiveIsolation','loopbackProtection']);
  for(const field of ['activeProfiles','applicableRules'])need(s.network[field]===null||(Number.isSafeInteger(s.network[field])&&s.network[field]>=0&&s.network[field]<=4096));
  if(s.checks.firewall==='PASS')need(Number.isSafeInteger(s.network.activeProfiles)&&s.network.activeProfiles>=1&&Number.isSafeInteger(s.network.applicableRules));
  need(s.network.effectiveIsolation==='UNPROVEN'&&s.network.loopbackProtection==='UNPROVEN');
  return Object.freeze({schema:'math.adminit.g0-review.v1',snapshotSha256:createHash('sha256').update(text).digest('hex'),snapshotQuality:Object.values(s.checks).every(x=>x==='PASS')?'OBSERVATIONS_COMPLETE':'INCOMPLETE',checks:Object.freeze({...s.checks}),authority:'NONE',isolationConfirmed:false,localExecute:false,admission:'BLOCKED',physicalG1:'BLOCKED',production:'NO_GO',bookGate:'CLOSED',q01:'OPEN',blockers:Object.freeze(['unattested-state-snapshot','effective-network-and-loopback-isolation-unproved','continuous-enforcement-unproved','independent-acceptance-and-explicit-admission-required'])});
 } catch {blocked();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {need(process.argv.length===2);let text='';for await(const chunk of process.stdin){text+=chunk.toString('utf8');need(Buffer.byteLength(text)<=16384);}console.log(JSON.stringify(auditG0Snapshot(text)));process.exitCode=2;}
 catch {console.error('G0_READONLY_BLOCKED');process.exitCode=2;}
}
