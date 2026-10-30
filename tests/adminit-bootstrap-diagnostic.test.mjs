import test from 'node:test';
import assert from 'node:assert/strict';
import {projectBootstrapDiagnostic} from '../scripts/adminit-containment/bootstrap-diagnostic.mjs';
test('diagnostic preserves access failure classification without publishing raw identity',()=>{
 const d=projectBootstrapDiagnostic({exitCode:2,exited:true,stderr:'BLOCKED: Medium token assignment BLOCKED win32=5\r\nsecret-user',stdout:'BOOTSTRAP_CLEANUP_CONFIRMED\r\n'});
 assert.equal(d.failure,'MEDIUM_TOKEN_ACCESS_DENIED');assert.equal(d.cleanup,'CONFIRMED_BY_BOOTSTRAP');
 assert.ok(!JSON.stringify(d).includes('secret-user'));assert.equal(d.nativeAcceptance,'BLOCKED');
});
test('unknown stderr and missing drain proof never become successful cleanup or native acceptance',()=>{
 for(const exitCode of [0,2]){const d=projectBootstrapDiagnostic({exitCode,exited:true,stdout:'',stderr:'private path and SID'});assert.equal(d.cleanup,'UNCONFIRMED');assert.equal(d.nativeAcceptance,'BLOCKED');assert.equal(d.failure,'UNCLASSIFIED');}
});
test('an unexited bootstrap cannot claim cleanup even with a marker',()=>{
 assert.equal(projectBootstrapDiagnostic({exitCode:2,exited:false,stdout:'BOOTSTRAP_CLEANUP_CONFIRMED',stderr:''}).cleanup,'UNCONFIRMED');
});
