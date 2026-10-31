import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {publicErrorCode,publicFailureType,startupCode,fixtureCode} from '../scripts/math-module-diagnostics.mjs';
import {terminalFailureAnnotations} from '../scripts/test-full-ci.mjs';

test('bounded fixture startup and message codes reflect only controlled public outcomes',()=>{
 assert.equal(startupCode({port:1234}),'CHILD_READY');
 assert.equal(startupCode({code:0,stdout:'private path'}),'CHILD_EXIT_ZERO_WITHOUT_READY');
 assert.equal(startupCode({code:1,stderr:'MATH_ENGINE_STARTUP_REJECTED\n'}),'CHILD_ENGINE_REJECTED');
 assert.equal(startupCode({code:1,stderr:"Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: private path"}),'CHILD_IMPORT_SCHEME_REJECTED');
 assert.equal(startupCode({code:1,stderr:'private-token\n::warning::forged'}),'CHILD_EXIT_ONE_OTHER');
 assert.equal(startupCode(null,Error('bounded startup deadline')),'STARTUP_DEADLINE');
 assert.equal(startupCode(null,Error('private-token')),'LAUNCH_ERROR_OTHER');
 for(const field of ['message','code']){
  const unknown={};Object.defineProperty(unknown,field,{get(){assert.fail('startup diagnostics invoked error getter')}});
  assert.equal(startupCode(null,unknown),'LAUNCH_ERROR_OTHER');
 }
 for(const field of ['port','code','stderr']){
  const unknown=field==='stderr'?{code:1}:{};Object.defineProperty(unknown,field,{get(){assert.fail('startup diagnostics invoked result getter')}});
  assert.equal(startupCode(unknown),field==='stderr'?'CHILD_EXIT_ONE_OTHER':'CHILD_NO_EXIT_CODE');
 }
 assert.equal(startupCode({code:1,stderr:'private-token-ERR_MODULE_NOT_FOUND'}),'CHILD_EXIT_ONE_OTHER');

 assert.equal(fixtureCode('MATH_MODULE_FIXTURE code=CHILD_READY'),'CHILD_READY');
 for(const value of ['MATH_MODULE_FIXTURE code=PRIVATE','MATH_MODULE_FIXTURE code=CHILD_READY\n::warning::forged','private/path',{},'x'.repeat(5000)])assert.equal(fixtureCode(value),null);
});
test('public error classification uses bounded fixed causes and never arbitrary messages',()=>{
 assert.equal(publicErrorCode(Object.assign(Error('private'),{code:'ERR_TEST_FAILURE',cause:Object.assign(Error('private'),{code:'EBUSY'})})),'EBUSY');
 assert.equal(publicFailureType('hookFailed'),'HOOK_FAILED');
 assert.equal(publicFailureType({failureType:'hookFailed'}),'HOOK_FAILED');
 assert.equal(publicFailureType('private\n::warning::forged'),'UNCLASSIFIED');
 assert.equal(publicErrorCode(Object.assign(Error('/private/token'),{code:'PRIVATE_CODE'})),'UNCLASSIFIED');
 const error={};Object.defineProperty(error,'code',{get(){assert.fail('diagnostics invoked getter')}});assert.equal(publicErrorCode(error),'UNCLASSIFIED');
 const typeError={};Object.defineProperty(typeError,'failureType',{get(){assert.fail('diagnostics invoked failureType getter')}});assert.equal(publicFailureType(typeError),'UNCLASSIFIED');
});
test('terminal annotations retain opaque identity and redact unknown diagnostic metadata',()=>{
 const expected=[{file:'tests/math-engine-module-health.test.mjs',parent:null,name:'fixture',occurrence:1}];
 const event={file:expected[0].file,parent:null,name:'fixture',status:'fail',diagnostic_code:'EBUSY',diagnostic_type:'HOOK_FAILED'};
 const good=terminalFailureAnnotations([event],expected).join('\n');assert.match(good,/code=EBUSY type=HOOK_FAILED/);
 const bad=terminalFailureAnnotations([{...event,diagnostic_code:'private\n::warning::forged',diagnostic_type:'secret/path'}],expected).join('\n');
 assert.doesNotMatch(bad,/private|secret|::warning/);assert.match(bad,/code=UNCLASSIFIED type=UNCLASSIFIED/);
 assert.deepEqual(terminalFailureAnnotations([{...event,status:'pass'}],expected),[]);
});
test('actual reporter forwards only fixed failed-fixture codes while terminal evidence stays strict',()=>{
 const root=mkdtempSync(join(tmpdir(),'math-public-diag-'));
 try{
  mkdirSync(join(root,'tests'));
  const fixture=join(root,'tests/math-engine-module-health.test.mjs');
  const title='owned actual clean Git source and real numerical baseline expose exact authenticated health';
  writeFileSync(fixture,"import test from'node:test';for(const name of "+JSON.stringify([title,'synthetic unknown fixture'])+"){test(name,t=>{t.diagnostic('MATH_MODULE_FIXTURE code=CHILD_READY');t.diagnostic('private-token\\n::warning::forged');t.after(()=>{throw Object.assign(Error('private-path-token'),{code:'EBUSY'})})});}");
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,['--test','--test-reporter='+resolve('scripts/platform-test-reporter.mjs'),fixture],{cwd:root,env,encoding:'utf8',timeout:10000});
  assert.equal(result.status,1);const records=result.stdout.trim().split('\n').map(JSON.parse);
  const terminal=records.find(x=>x.type==='terminal'&&x.name===title);
  assert.equal(terminal.status,'fail');assert.equal(terminal.diagnostic_code,'EBUSY');assert.equal(terminal.diagnostic_type,'HOOK_FAILED');
  assert.ok(records.every(x=>['terminal','summary'].includes(x.type)));assert.equal(records.at(-1).success,false);
  assert.match(result.stderr,/MATH_MODULE_FIXTURE case_id=[a-f0-9]{64} code=CHILD_READY/);
  assert.equal((result.stderr.match(/MATH_MODULE_FIXTURE case_id=/g)??[]).length,1,'unknown test identity cannot emit fixture notice');
  assert.doesNotMatch(result.stdout+result.stderr,/private-path-token|private-token|::warning::forged/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
