import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as verifier from '../scripts/adminit-containment/verify-native.mjs';
const identity=pid=>({pid,createdFileTime:'134000000000000001',handle:pid.toString(16),signalled:true});
const probe=()=>({scenario:'watchdog',status:'BLOCKED',reason:'forced independent owner watchdog expired',waitResult:258,liveBeforeExpiry:true,outerCleanupConfirmed:true,leafAssignedBeforeResume:true,owner:identity(10),root:identity(11),leaf:identity(12)});
test('forced watchdog proof accepts only BLOCKED outcome with signalled owned handles',()=>{assert.equal(verifier.validateForcedWatchdogProbe(probe()).status,'BLOCKED');});
for(const [name,change] of [['PASS',p=>p.status='PASS'],['missing drain',p=>p.outerCleanupConfirmed=false],['dead before expiry',p=>p.liveBeforeExpiry=false],['no timeout',p=>p.waitResult=0],['surviving leaf',p=>p.leaf.signalled=false],['PID collision',p=>p.leaf.pid=p.root.pid],['no membership',p=>p.leafAssignedBeforeResume=false]])test('watchdog rejects '+name,()=>{const p=probe();change(p);assert.throws(()=>verifier.validateForcedWatchdogProbe(p),/BLOCKED/);});
test('native watchdog uses readiness barrier then zero wait, confirmed outer drain and handle waits',()=>{const s=readFileSync(new URL('./fixtures/adminit-containment/AdminitSynthetic.cs',import.meta.url),'utf8');assert.match(s,/kind=="watchdog"/);assert.match(s,/AwaitOwnerDeadline\(k,owner,0\)/);assert.match(s,/status="BLOCKED",scenario=kind,reason="forced independent owner watchdog expired"/);assert.match(s,/forced watchdog descendants survived/);});
test('forced deadline shares production owner wait and finally cleanup, not a duplicate terminate path',()=>{const s=readFileSync(new URL('./fixtures/adminit-containment/AdminitSynthetic.cs',import.meta.url),'utf8');assert.match(s,/AwaitOwnerDeadline\(k,owner,0\)/);assert.match(s,/AwaitOwnerDeadline\(k,owner,25000\)/);assert.match(s,/if\(forcedExpiry\)/);});

test('watchdog rejects swapped, malformed and aliased handle identities',()=>{
 for(const mutate of [
  p=>p.root.createdFileTime='0',
  p=>p.leaf.pid=true,
  p=>p.owner.signalled=false,
  p=>p.outerCleanupConfirmed='true',
  p=>p.waitResult=0xffffffff,
  p=>p.reason='forced independent owner watchdog expired; PASS',
 ]){
  const p=probe();mutate(p);
  assert.throws(()=>verifier.validateForcedWatchdogProbe(p),/BLOCKED/);
 }
});

for(const [name,mutate] of [
 ['WAIT_FAILED',p=>p.waitResult=0xffffffff],
 ['unexpected wait code',p=>p.waitResult=128],
 ['owner survives cleanup',p=>p.owner.signalled=false],
 ['root survives cleanup',p=>p.root.signalled=false],
 ['leaf survives cleanup',p=>p.leaf.signalled=false],
 ['lost root creation identity',p=>delete p.root.createdFileTime],
 ['lost leaf handle identity',p=>p.leaf.handle='0'],
 ['duplicate process identity',p=>{p.leaf.pid=p.root.pid;p.leaf.createdFileTime=p.root.createdFileTime;}],
 ['cleanup confirmation missing',p=>delete p.outerCleanupConfirmed],
 ['cleanup confirmation string',p=>p.outerCleanupConfirmed='true'],
 ['false PASS on forced expiry',p=>p.status='PASS'],
])test('forced watchdog fail-closed negative: '+name,()=>{
 const p=probe();mutate(p);
 assert.throws(()=>verifier.validateForcedWatchdogProbe(p),/BLOCKED/);
});

test('forced watchdog verifier rejects invalid process identity and cleanup evidence',()=>{
 for(const mutate of [
  p=>p.owner.pid=0,
  p=>p.root.handle='not-hex',
  p=>p.leaf.createdFileTime='not-a-filetime',
  p=>p.liveBeforeExpiry=false,
  p=>p.leafAssignedBeforeResume=false,
  p=>p.waitResult=null,
 ]){
  const p=probe();mutate(p);
  assert.throws(()=>verifier.validateForcedWatchdogProbe(p),/BLOCKED/);
 }
});

test('forced watchdog rejects aliased observer handles despite distinct PIDs',()=>{
 for(const alias of [p=>p.leaf.handle=p.root.handle,p=>p.owner.handle=p.root.handle]){
  const p=probe();alias(p);
  assert.throws(()=>verifier.validateForcedWatchdogProbe(p),/BLOCKED/);
 }
});

test('forced watchdog rejects non-unique handles even when creation FILETIMEs differ',()=>{
 const p=probe();
 p.owner.createdFileTime='134000000000000002';
 p.leaf.createdFileTime='134000000000000003';
 p.leaf.handle=p.owner.handle;
 assert.throws(()=>verifier.validateForcedWatchdogProbe(p),/BLOCKED/);
});

test('forced watchdog rejects missing and duplicate handle evidence',()=>{
 for(const mutate of [
  p=>delete p.owner.handle,
  p=>p.root.handle='',
  p=>p.leaf.handle=p.root.handle,
 ]){
  const p=probe();mutate(p);
  assert.throws(()=>verifier.validateForcedWatchdogProbe(p),/BLOCKED/);
 }
});

test('forced watchdog schema cannot independently bind swapped owner/root handle values',()=>{
 const p=probe();
 const tmp=p.owner.handle;p.owner.handle=p.root.handle;p.root.handle=tmp;
 // A bare numeric handle value cannot independently authenticate process ownership.
 // This remains a synthetic schema check, not proof of actual OS handle binding.
 assert.equal(verifier.validateForcedWatchdogProbe(p).status,'BLOCKED');
 // The accepted negative-probe schema must never be promoted to native PASS.
});

test('forced watchdog rejects missing signalled process-handle confirmation',()=>{
 for(const name of ['owner','root','leaf']){
  const p=probe();delete p[name].signalled;
  assert.throws(()=>verifier.validateForcedWatchdogProbe(p),/BLOCKED/);
 }
});
