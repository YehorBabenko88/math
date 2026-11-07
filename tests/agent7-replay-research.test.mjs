// Independent offline regressions. No native containment or distributed acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {FileReplayLedger} from '../src/knowledge/file-replay-ledger.mjs';
import {newReplayFilter, observeClaim} from '../src/ai-orchestrator/replay.mjs';
import {runBoundedExperiment} from '../src/bounded-experiment.mjs';
import {childDiagnosticPhase} from '../scripts/math-module-diagnostics.mjs';
import {loadInventory, validateEvents} from '../scripts/platform-coverage.mjs';

const key = '7'.repeat(64);
const moduleUrl = new URL('../src/knowledge/file-replay-ledger.mjs', import.meta.url).href;
const input = {schema:'math.evaluate.v1', mode:'HISTORICAL_RESEARCH',
  execution_authority:false, closes:Array.from({length:500}, (_,i)=>100+i/100)};

test('agent7 durable claim survives child loss after consumption', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'agent7-replay-'));
  try {
    const child=spawnSync(process.execPath,['--input-type=module','-e',
      `import {FileReplayLedger} from ${JSON.stringify(moduleUrl)}; const won=await new FileReplayLedger(process.argv[1]).consume(process.argv[2]); process.exit(won?71:72);`,dir,key],
      {encoding:'utf8',timeout:10000,windowsHide:true});
    assert.equal(child.error,undefined); assert.equal(child.status,71);
    assert.equal(await new FileReplayLedger(dir).consume(key),false);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('agent7 child loss before consumption leaves an admissible retry', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'agent7-before-'));
  try {
    const child=spawnSync(process.execPath,['-e','process.exit(71)'],{timeout:10000,windowsHide:true});
    assert.equal(child.error,undefined); assert.equal(child.status,71);
    assert.equal(await new FileReplayLedger(dir).consume(key),true);
    assert.equal(await new FileReplayLedger(dir).consume(key),false);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('agent7 incomplete consumption marker stays conservatively consumed', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'agent7-partial-'));
  try {
    await writeFile(join(dir,key),'',{flag:'wx',mode:0o600});
    assert.equal(await new FileReplayLedger(dir).consume(key),false);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('agent7 concurrent retry has one winner without granting completion', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'agent7-race-'));
  try {
    const results=await Promise.all(Array.from({length:16},()=>new FileReplayLedger(dir).consume(key)));
    assert.equal(results.filter(Boolean).length,1);
    // A consumed claim is not a research result or proof of distributed completion.
    assert.equal(await new FileReplayLedger(dir).consume(key),false);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('agent7 malformed replay keys are rejected without path interpretation', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'agent7-invalid-'));
  try {
    for(const id of ['../escape','A'.repeat(64),'7'.repeat(63),'7'.repeat(65)])
      await assert.rejects(new FileReplayLedger(dir).consume(id),/invalid request id/);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('agent7 ephemeral attempt filter does not claim durable fencing',()=>{
  const claim={taskId:'synthetic-job',attempt:1,receiptHash:key};
  const used=observeClaim(newReplayFilter(),claim);
  assert.throws(()=>observeClaim(used,{...claim,receiptHash:'8'.repeat(64)}),/REPLAY_DETECTED/);
  assert.equal(observeClaim(used,{...claim,attempt:2}).entries.length,2);
  assert.equal(observeClaim(newReplayFilter(),claim).entries.length,1);
});

test('agent7 numerical replay agrees after cancelled worker and denies authority',async()=>{
  const first=await runBoundedExperiment(input);
  const controller=new AbortController();controller.abort();
  await assert.rejects(runBoundedExperiment(input,{signal:controller.signal}),/CANCELLED/);
  assert.deepEqual(await runBoundedExperiment(structuredClone(input)),first);
  assert.equal(first.execution_authority,false);
  await assert.rejects(runBoundedExperiment({...input,execution_authority:true}),/INVALID_RESEARCH_REQUEST/);
});

test('agent7 loader timeout and process exit remain distinct diagnostic failures',async()=>{
  assert.equal(childDiagnosticPhase({error:Object.assign(new Error('synthetic'),{code:'ETIMEDOUT'})}),'DIAG_CHILD_TIMEOUT');
  assert.equal(childDiagnosticPhase({status:0xc0000142}),'DIAG_CHILD_EXIT_OTHER');
  assert.equal(childDiagnosticPhase({status:0}),'DIAG_CHILD_EXIT_ZERO');
  const expected=loadInventory().tests.filter(x=>x.destination==='tests/agent7-replay-research.test.mjs');
  assert.equal(expected.length,8,'all additional regressions are mandatory cross-platform identities');
  assert.ok(expected.every(x=>x.platform==='cross'));
  assert.ok(expected.every(x=>x.added===true),'new regressions must not masquerade as the frozen baseline');
  const events=expected.map(x=>({...x,status:'pass'}));
  assert.equal(validateEvents(events,expected).length,8);
  assert.throws(()=>validateEvents(events.slice(1),expected),/Exact test identity/);
  assert.throws(()=>validateEvents([...events,{...events[0],name:'unregistered'}],expected),/Exact test identity/);
  const fixture=await readFile(new URL('./adminit-loader-facts.windows.mjs',import.meta.url),'utf8');
  const recipe=JSON.parse(fixture.match(/const script=("(?:\\.|[^"\\])*");/)[1]);
  const paths=[...recipe.match(/\$files=@\(([^)]+)\)/)[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
  const sources=await Promise.all(paths.map(path=>readFile(new URL('../'+path,import.meta.url),'utf8')));
  // Compile inputs must define the types consumed by the CLR diagnostic, before
  // any own-token/native regression can be meaningfully attempted.
  assert.ok(/class OwnedPrivateDesktop\b/.test(sources.join('\n')),'CLR recipe omits owned desktop dependency');
  assert.ok(/class HostedPrivateDesktop\b/.test(sources.join('\n')),'CLR recipe omits desktop factory dependency');
  // The zero diagnostic code does not constitute native or security admission.
  const reporterUrl=new URL('../scripts/agent7-loader-init/report.mjs',import.meta.url);
  await assert.doesNotReject(readFile(reporterUrl),'closed diagnostic parser is required');
  const {parseTrace}=await import(reporterUrl.href);
  const identity={head:'1'.repeat(40),tree:'2'.repeat(40)};
  const sample={schema:'math.loader-init-trace.v1',...identity,qualification:'NONE',nativeAcceptance:'BLOCKED',outcome:'DLL_INITIALIZATION_FAILED',events:7,breakpointHandled:true,firstException:'NONE',lastModule:'OS_NTDLL',cleanup:'CONFIRMED'};
  const line=JSON.stringify(sample)+'\n';
  assert.deepEqual(parseTrace(line,identity),sample);
  for(const bad of [line+line,line.replace('"events":7','"events":7,"events":8'),line.replace('"qualification":"NONE"','"qualification":"PASS"'),JSON.stringify({...sample,pid:123}),JSON.stringify({...sample,events:257}),JSON.stringify({...sample,head:'3'.repeat(40)}),JSON.stringify({...sample,lastModule:'C:\\private\\x.dll'}),' '.repeat(8193)])
    assert.throws(()=>parseTrace(bad,identity),/TRACE_REJECTED/);
  if(process.platform==='win32') {
    const workflow=await readFile(new URL('../.github/workflows/agent7-loader-init-trace.yml',import.meta.url),'utf8');
    assert.match(workflow,/pull_request:\s+types: \[labeled\]/);
    assert.doesNotMatch(workflow,/pull_request_target:|workflow_dispatch:|^  push:/m);
    const admission=workflow.match(/# BEGIN_PURE_EVENT_ADMISSION\r?\n([\s\S]*?)\s+# END_PURE_EVENT_ADMISSION/)[1];
    const good={eventName:'pull_request',actor:'YehorBabenko88',triggeringActor:'YehorBabenko88',attempt:'1',eventSha:'a'.repeat(40),repository:'YehorBabenko88/math',action:'labeled',pr:115,head:'b'.repeat(40),branch:'agent7/math-loader-init-followup-20261107',base:'agent7/math-verifier-import-20261107',headRepo:'YehorBabenko88/math',baseRepo:'YehorBabenko88/math',label:'diag-f-'+'b'.repeat(40),description:'followup-review-sha256:'+'c'.repeat(64)};
    const mutations={eventName:'pull_request_target',actor:'someone',triggeringActor:'someone',attempt:'2',eventSha:'invalid',repository:'someone/math',action:'synchronize',pr:113,head:'B'.repeat(40),branch:'agent7/math-loader-init-diagnostics-20261106',base:'agent7/math-native-research-20261106',headRepo:'someone/math',baseRepo:'someone/math',label:'diag-'+'b'.repeat(40),description:'review-sha256:'+'c'.repeat(64)};
    const oldTooLongLabel='diag-followup-'+'b'.repeat(40);
    assert.equal(Buffer.byteLength(good.label,'utf8'),47);assert.ok(Buffer.byteLength(good.label,'utf8')<=50);
    assert.equal(Buffer.byteLength(oldTooLongLabel,'utf8'),54);assert.ok(Buffer.byteLength(oldTooLongLabel,'utf8')>50);
    const vectors=[good,...Object.entries(mutations).map(([k,v])=>({...good,[k]:v})),{...good,label:oldTooLongLabel}];
    const eventScript="$ErrorActionPreference='Stop';"+admission+"\n$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:AGENT7_EVENT_VECTORS))|ConvertFrom-Json;$n=0;foreach($x in $v){$ok=$false;try{$r=Admit-TraceEvent $x;$ok=$true}catch{};if($ok -ne ($n -eq 0)){throw 'EVENT_MODEL_FAILED'};if($ok -and ($r.SourceHead -cne $x.head -or $r.EventSha -cne $x.eventSha -or $r.SourceHead -ceq $r.EventSha -or $r.ReviewRecordSha256 -cne ('c'*64))){throw 'RECEIPT_MODEL_FAILED'};$n++};Write-Output ('EVENT_MODEL_ONLY cases='+$n)";
    const eventModel=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(eventScript,'utf16le').toString('base64')],{encoding:'utf8',timeout:30000,maxBuffer:8192,windowsHide:true,env:{...process.env,AGENT7_EVENT_VECTORS:Buffer.from(JSON.stringify(vectors)).toString('base64')}});
    assert.equal(eventModel.error,undefined);assert.equal(eventModel.status,0,eventModel.stderr);assert.match(eventModel.stdout,/EVENT_MODEL_ONLY cases=17/);
    const builder=await readFile(new URL('../scripts/agent7-loader-init/build.ps1',import.meta.url),'utf8');
    const verifyLine=builder.match(/^\$verify='.*'$/m)[0];
    const beforeLine=builder.match(/^\$before=& node .*$/m)[0];
    const afterLine=builder.match(/^\$after=& node .*$/m)[0];
    const readFunction=builder.match(/^function Read-Committed\([\s\S]*?^}/m)[0];
    const recipeDir=await mkdtemp(join(tmpdir(),'agent7-ps-'));
    try {
      const validator=join(recipeDir,'validator.mjs');
      await writeFile(validator,"export const verifySourceIdentity=()=>({trackedSourceSha256:'a'.repeat(64)});\n");
      const script="$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop';$ExpectedHead=$env:AGENT7_RECIPE_HEAD;$validator=$env:AGENT7_VALIDATOR;"+verifyLine+"\n"+beforeLine+"\nif($LASTEXITCODE -ne 0){exit $LASTEXITCODE};\n"+readFunction+"\n$v=Read-Committed 'tests/fixtures/adminit-containment/ClrEntryProbe.cs';if($v -notmatch 'class ClrEntryProbe'){throw 'RECIPE_FAILED'};Write-Output 'RECIPES_MODEL_ONLY'";
      const child=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',timeout:30000,maxBuffer:8192,windowsHide:true,env:{...process.env,AGENT7_VALIDATOR:validator,AGENT7_RECIPE_HEAD:spawnSync('git',['--no-replace-objects','rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).stdout.trim()}});
      assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);assert.match(child.stdout,/RECIPES_MODEL_ONLY/);
      const {mkdir}=await import('node:fs/promises');
      const actual=join(recipeDir,'actual');await mkdir(actual);
      const realValidator=join(actual,'verify-source-identity.mjs');
      await writeFile(realValidator,await readFile(new URL('../scripts/verify-source-identity.mjs',import.meta.url)));
      await writeFile(join(actual,'inert.txt'),'raw fixture source\n');
      const cleanEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('GIT_')));
      Object.assign(cleanEnv,{GIT_CONFIG_GLOBAL:'NUL',GIT_CONFIG_NOSYSTEM:'1'});
      const git=(...args)=>{
        const r=spawnSync('git',['--no-replace-objects','-c','core.hooksPath=NUL','-c','core.autocrlf=false',...args],{cwd:actual,env:cleanEnv,encoding:'utf8',timeout:10000,maxBuffer:8192,windowsHide:true});
        assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);return r.stdout.trim();
      };
      git('init','-q');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','real verifier import fixture');
      const fixtureHead=git('rev-parse','HEAD');
      // Copy the REAL unchanged module, including its CLI entry guard. A fake
      // export cannot expose process.argv[1] accidentally masquerading as Main.
      const actualScript="$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop';$ExpectedHead=$env:AGENT7_REAL_HEAD;$validator=$env:AGENT7_REAL_VALIDATOR;"+verifyLine+"\n"+beforeLine+"\nif($LASTEXITCODE -ne 0){exit $LASTEXITCODE};\n"+afterLine+"\nif($LASTEXITCODE -ne 0){exit $LASTEXITCODE};if($before -cnotmatch '^[a-f0-9]{64}$' -or $after -cne $before){throw 'REAL_VERIFIER_FAILED'};Write-Output 'REAL_VERIFIER_IMPORT_ONLY'";
      const runActual=()=>spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(actualScript,'utf16le').toString('base64')],{cwd:actual,env:{...cleanEnv,AGENT7_REAL_HEAD:fixtureHead,AGENT7_REAL_VALIDATOR:realValidator},encoding:'utf8',timeout:30000,maxBuffer:8192,windowsHide:true});
      const verified=runActual();assert.equal(verified.error,undefined);assert.equal(verified.status,0,verified.stderr);assert.equal(verified.stderr,'');assert.match(verified.stdout,/REAL_VERIFIER_IMPORT_ONLY/);
      await writeFile(join(actual,'inert.txt'),'dirty source must still refuse\n');
      const dirty=runActual();assert.equal(dirty.error,undefined);assert.notEqual(dirty.status,0);assert.doesNotMatch(dirty.stdout,/REAL_VERIFIER_IMPORT_ONLY/);
    } finally {await rm(recipeDir,{recursive:true,force:true});}
    // Compile + injected MODEL only. Never invoke Main or a native backend here.
    const source=new URL('./fixtures/agent7-loader-init/HostedLoaderInitTrace.cs',import.meta.url);
    const modelScript="$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop';$r=$env:AGENT7_MODEL_REPO;$s=[IO.File]::ReadAllText((Join-Path $r 'scripts/q01-lab/WindowsJobContainment.cs'))+[char]10+[IO.File]::ReadAllText((Join-Path $r 'tests/fixtures/adminit-containment/HostedPrivateDesktop.cs'))+[char]10+[IO.File]::ReadAllText($env:AGENT7_MODEL_SOURCE);Add-Type -TypeDefinition $s;[MathUniverse.Agent7.LoaderInitTrace]::RunModelTests()";
    const {fileURLToPath}=await import('node:url');
    const model=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(modelScript,'utf16le').toString('base64')],{encoding:'utf8',timeout:30000,maxBuffer:8192,windowsHide:true,env:{...process.env,AGENT7_MODEL_SOURCE:fileURLToPath(source),AGENT7_MODEL_REPO:fileURLToPath(new URL('../',import.meta.url))}});
    assert.equal(model.error,undefined);assert.equal(model.status,0,model.stderr);
    assert.match(model.stdout,/MODEL_ONLY cases=\d+ qualification=NONE/);
  }
});
