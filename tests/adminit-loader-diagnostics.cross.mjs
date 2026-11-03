import test from 'node:test';import assert from 'node:assert/strict';
import {loaderFactLines} from '../scripts/adminit-containment/report-loader-facts.mjs';
import {clrDiagnosticLines} from '../scripts/adminit-containment/report-clr-diagnostic.mjs';
import {terminalFailureAnnotations} from '../scripts/test-full-ci.mjs';
import {publicWorkerPhase} from '../scripts/math-module-diagnostics.mjs';
test('loader diagnostics use closed bounded token runtime and NON_QUALIFYING entry grammars',()=>{
 const token='HOSTED_TOKEN_FACT name=LIMITED available=true integrity=MEDIUM elevation=LIMITED kind=PRIMARY restricted=true admin_enabled=false admin_deny_only=true same_user=true same_session=true';
 const runtime='HOSTED_RUNTIME_FACT name=CLR available=true pin_match=true allowed=true label=UNLABELLED no_write_up=false no_read_up=false no_execute_up=false class=NONE';
 assert.deepEqual(loaderFactLines(token+'\n'+runtime),[token,runtime]);
 for(const bad of [token+'\n'+token,token.replace('MEDIUM','secret'),token.replace('available=true','available=false'),runtime.replace('pin_match=true','pin_match=false'),'X'.repeat(16385)])assert.deepEqual(loaderFactLines(bad),[]);
 const probe='HOSTED_CLR_DIAGNOSTIC variant=BASE outcome=CLR_ENTRY_REACHED qualification=NONE';assert.deepEqual(clrDiagnosticLines(probe),[probe]);
 for(const bad of [probe.replace('NONE','PASS'),probe+'\n'+probe,probe+'\nsecret',probe.replace('BASE','SETUP'),'X'.repeat(2049)])assert.deepEqual(clrDiagnosticLines(bad),[]);
 const identity={file:'tests/synthetic',name:'fixed',parent:null,occurrence:1};const notice=terminalFailureAnnotations([{...identity,status:'fail',diagnostic_worker_phase:'COMPILE'}],[identity]).join('\n');assert.match(notice,/worker_phase=COMPILE/);const blocked=terminalFailureAnnotations([{...identity,status:'fail',diagnostic_worker_phase:'secret/path'}],[identity]).join('\n');assert.doesNotMatch(blocked,/secret/);assert.match(blocked,/worker_phase=UNAVAILABLE/);
 assert.equal(publicWorkerPhase({publicWorkerPhase:'COMPILE'}),'COMPILE');assert.equal(publicWorkerPhase({publicWorkerPhase:'secret'}),'UNAVAILABLE');assert.equal(publicWorkerPhase({get publicWorkerPhase(){throw Error('getter');}}),'UNAVAILABLE');
});
