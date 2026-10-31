import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,win32} from 'node:path';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {verifySourceIdentity} from '../scripts/verify-source-identity.mjs';
import * as diagnostics from '../scripts/math-module-diagnostics.mjs';
import {publicErrorCode,publicFailureType,startupCode,fixtureCode} from '../scripts/math-module-diagnostics.mjs';
import {terminalFailureAnnotations} from '../scripts/test-full-ci.mjs';

test('bounded fixture startup and message codes reflect only controlled public outcomes',()=>{
 const canonicalRoot=mkdtempSync(join(tmpdir(),'math-raw-attributes-')),previous=process.cwd();
 const git=(...args)=>execFileSync('git',['-C',canonicalRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git('init','--quiet');
  const attributes=readFileSync(new URL('../.gitattributes',import.meta.url),'utf8');
  writeFileSync(join(canonicalRoot,'.gitattributes'),attributes);
  git('-c','core.autocrlf=false','add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','inert metadata');
  const head=git('rev-parse','HEAD');git('config','core.autocrlf','false');
  writeFileSync(join(canonicalRoot,'.gitattributes'),attributes.replaceAll('\n','\r\n'));
  process.chdir(canonicalRoot);assert.throws(()=>verifySourceIdentity(head),/Tracked source bytes differ/);
  git('-c','core.autocrlf=false','checkout-index','--all','--force','--index');
  assert.equal(readFileSync('.gitattributes','utf8'),attributes);assert.equal(verifySourceIdentity(head).sourceSha,head);
  rmSync('.gitattributes');git('-c','core.autocrlf=true','-c','core.eol=crlf','checkout-index','--all','--force','--index');
  assert.equal(readFileSync('.gitattributes','utf8'),attributes,'self-policy preserves metadata under inherited CRLF normalization');
  writeFileSync('.gitattributes',attributes+'# actual post-checkout edit\n');
  assert.throws(()=>verifySourceIdentity(head),/Tracked source bytes differ/);
 }finally{process.chdir(previous);rmSync(canonicalRoot,{recursive:true,force:true})}
 const source=readFileSync(new URL('../src/math-engine-server.mjs',import.meta.url),'utf8');
 const actualGitGuard=source.split('\n').find(line=>line.includes('if(!isAbsolute(gitPath)'));
 assert.ok(actualGitGuard,'exercise actual production Git executable guard');
 const executable=Buffer.from('inert pinned executable bytes'),sha=createHash('sha256').update(executable).digest('hex');
 const checkGitPath=gitPath=>runInNewContext(actualGitGuard,{gitPath,isAbsolute:win32.isAbsolute,createHash,regular:()=>executable,env:{UNIFIED_GIT_SHA256:sha}});
 assert.doesNotThrow(()=>checkGitPath(String.raw`C:\Program Files\Git\cmd\git.exe`));
 assert.doesNotThrow(()=>checkGitPath('C:/Program Files/Git/cmd/git.exe'));
 assert.throws(()=>checkGitPath('git.exe'));
 assert.throws(()=>checkGitPath(String.raw`C:relative\git.exe`));
 assert.equal(diagnostics.childDiagnosticPhase({status:0}),'DIAG_CHILD_EXIT_ZERO');
 assert.equal(diagnostics.childDiagnosticPhase({status:1,stderr:'Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: private path'}),'DIAG_CHILD_IMPORT_SCHEME');
 assert.equal(diagnostics.childDiagnosticPhase({status:9,stderr:'private token'}),'DIAG_CHILD_EXIT_OTHER');
 assert.equal(diagnostics.childDiagnosticPhase({error:{code:'ETIMEDOUT'}}),'DIAG_CHILD_TIMEOUT');
 assert.equal(diagnostics.childDiagnosticPhase({signal:'SIGTERM'}),'DIAG_CHILD_SIGNAL');
 const childGetter={};Object.defineProperty(childGetter,'error',{get(){assert.fail('child classifier getter')}});assert.equal(diagnostics.childDiagnosticPhase(childGetter),'DIAG_CHILD_EXIT_OTHER');
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
 assert.equal(diagnostics.phaseCode({schema:'math.fixture.phase.v1',phase:'RAW_BYTES',authority:false}),'PHASE_RAW_BYTES');
 for(const message of [{schema:'math.fixture.phase.v1',phase:'RAW_BYTES',authority:true},{schema:'math.fixture.phase.v1',phase:'PRIVATE',authority:false},{schema:'math.fixture.phase.v1',phase:'RAW_BYTES',authority:false,private:'hidden'},null])assert.equal(diagnostics.phaseCode(message),null);
 const message={schema:'math.fixture.phase.v1',authority:false};Object.defineProperty(message,'phase',{enumerable:true,get(){assert.fail('private IPC getter invoked')}});assert.equal(diagnostics.phaseCode(message),null);

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
 const event={file:expected[0].file,parent:null,name:'fixture',status:'fail',diagnostic_code:'EBUSY',diagnostic_type:'HOOK_FAILED',diagnostic_phase:'DIAG_NOTICE_FORWARDING'};
 const good=terminalFailureAnnotations([event],expected).join('\n');assert.match(good,/code=EBUSY type=HOOK_FAILED/);
 const bad=terminalFailureAnnotations([{...event,diagnostic_code:'private\n::warning::forged',diagnostic_type:'secret/path',diagnostic_phase:'private-phase'}],expected).join('\n');
 assert.doesNotMatch(bad,/private|secret|::warning/);assert.match(bad,/code=UNCLASSIFIED type=UNCLASSIFIED/);
 assert.deepEqual(terminalFailureAnnotations([{...event,status:'pass'}],expected),[]);
});
test('actual reporter forwards only fixed failed-fixture codes while terminal evidence stays strict',async()=>{
 const root=mkdtempSync(join(tmpdir(),'math-public-diag-'));let comparisonPhase='DIAG_CHILD_STATUS';
 try{
  mkdirSync(join(root,'tests'));
  const fixture=join(root,'tests/math-engine-module-health.test.mjs');
  const title='owned actual clean Git source and real numerical baseline expose exact authenticated health';
  writeFileSync(fixture,"import test from'node:test';for(const name of "+JSON.stringify([title,'synthetic unknown fixture'])+"){test(name,t=>{t.diagnostic('MATH_MODULE_FIXTURE code=CHILD_READY');t.diagnostic('MATH_MODULE_FIXTURE code=CHILD_READY');t.diagnostic('private-token\\n::warning::forged');t.after(()=>{throw Object.assign(Error('private-path-token'),{code:'EBUSY',publicDiagnosticPhase:'DIAG_NOTICE_FORWARDING'})})});}");
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,['--test','--test-reporter='+resolve('scripts/platform-test-reporter.mjs'),fixture],{cwd:root,env,encoding:'utf8',timeout:10000});
  comparisonPhase=diagnostics.childDiagnosticPhase(result);assert.equal(result.status,1);comparisonPhase='DIAG_EVIDENCE_PARSE';const records=result.stdout.trim().split('\n').map(JSON.parse);
  comparisonPhase='DIAG_TERMINAL_FIELDS';
  const terminal=records.find(x=>x.type==='terminal'&&x.name===title);
  assert.equal(terminal.status,'fail');assert.equal(terminal.diagnostic_code,'EBUSY');assert.equal(terminal.diagnostic_type,'HOOK_FAILED');assert.equal(terminal.diagnostic_phase,'DIAG_NOTICE_FORWARDING');
  comparisonPhase='DIAG_FILE_IDENTITY';assert.equal(terminal.file,'tests/math-engine-module-health.test.mjs');
  assert.ok(records.every(x=>['terminal','summary'].includes(x.type)));assert.equal(records.at(-1).success,false);
  comparisonPhase='DIAG_NOTICE_FORWARDING';
  assert.match(result.stderr,/MATH_MODULE_FIXTURE case_id=[a-f0-9]{64} codes=CHILD_READY/);
  assert.equal((result.stderr.match(/MATH_MODULE_FIXTURE case_id=/g)??[]).length,1,'unknown test identity cannot emit fixture notice');
  comparisonPhase='DIAG_PRIVACY';
  assert.doesNotMatch(result.stdout+result.stderr,/private-path-token|private-token|::warning::forged/);
  comparisonPhase='DIAG_PRIVATE_IPC';
  const privateEnv={...process.env};for(const key of Object.keys(privateEnv))if(key.startsWith('UNIFIED_'))delete privateEnv[key];privateEnv.UNIFIED_MODULE_ID='INVALID';
  const absent=spawnSync(process.execPath,[resolve('src/math-engine-server.mjs')],{env:privateEnv,encoding:'utf8',timeout:5000});
  assert.equal(absent.status,1);assert.equal(absent.stdout,'');assert.equal(absent.stderr.trim(),'MATH_ENGINE_STARTUP_REJECTED');
  const child=spawn(process.execPath,[resolve('src/math-engine-server.mjs')],{env:privateEnv,stdio:['ignore','pipe','pipe','ipc']});
  const messages=[];let stdout='',stderr='';child.on('message',message=>messages.push(message));child.stdout.on('data',part=>stdout+=part);child.stderr.on('data',part=>stderr+=part);
  let timer;const code=await new Promise((done,reject)=>{timer=setTimeout(()=>{child.kill();reject(Error('private IPC fixture deadline'))},5000);child.once('error',reject);child.once('close',done)}).finally(()=>clearTimeout(timer));
  assert.equal(code,1);assert.equal(stdout,'');assert.equal(stderr.trim(),'MATH_ENGINE_STARTUP_REJECTED');
  assert.deepEqual(messages,[{schema:'math.fixture.phase.v1',phase:'SOURCE_IDENTITY',authority:false}]);
 }catch(error){try{Object.defineProperty(error,'publicDiagnosticPhase',{value:comparisonPhase,enumerable:true,configurable:true})}catch{}throw error;}
 finally{rmSync(root,{recursive:true,force:true})}
});
