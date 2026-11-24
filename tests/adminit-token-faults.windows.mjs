import{validateTokenObservation}from'../scripts/adminit-containment/token-contract.mjs';
import test from'node:test';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
for(const shell of ['powershell.exe','pwsh.exe'])test('instrumented production orchestration: '+shell,{skip:process.platform!=='win32'?'Windows compiler unavailable':false},()=>{const script=String.raw`$ErrorActionPreference='Stop'
$s=[IO.File]::ReadAllText($env:TOKEN_PRODUCTION)
$pattern='(?m)^  \[DllImport[^\r\n]+\r?$'
$declarations=@([regex]::Matches($s,$pattern));if($declarations.Count -ne 6){throw 'interop seam mismatch'}
$s=[regex]::Replace($s,$pattern,'')
if($s -match 'DllImport|extern '){throw 'unbound native seam'}
$s=$s.Replace('GetCurrentProcess()','new IntPtr(11)').Replace('GetCurrentThread()','new IntPtr(12)')
foreach($method in @('OpenProcessToken','OpenThreadToken','CloseHandle','GetTokenInformation')){$s=$s.Replace($method+'(','FakeNative.'+$method+'(')}
$s=$s.Replace('Marshal.GetLastWin32Error()','FakeNative.Error').Replace('Marshal.AllocHGlobal(','FakeNative.Allocate(').Replace('Marshal.FreeHGlobal(','FakeNative.Free(')
$s=$s.Replace('Array.Clear(','FakeNative.Clear(').Replace('Marshal.Copy(','FakeNative.Copy(')
$s=$s.Replace('new byte[size]','FakeNative.Track(new byte[size])')
$s=$s.Replace('new byte[16]','FakeNative.Track(new byte[16])').Replace('new byte[12]','FakeNative.Track(new byte[12])')
$fake=[regex]::Replace([IO.File]::ReadAllText($env:TOKEN_FAKE),'(?m)^using [^;]+;\r?$','')
if(-not $s.Contains('using System.Collections.Generic;')){$s='using System.Collections.Generic;'+[Environment]::NewLine+$s}
try{[void](Add-Type -TypeDefinition ($s+[Environment]::NewLine+$fake) -ErrorAction Stop)}catch{'TOKEN_COMPILE_BLOCKED';exit 1}
foreach($fault in @('none','query-after-sid','close-current','open','open-current','thread-error','impersonation','query','alloc','alloc-zero','huge','short','pointer','sid','elevation','changed','group-table','close','query-size','query-length','alloc-late','free','clear','copy','close-throw','close-current-throw','thread-close','stats-size','group-pointer','group-duplicate','group-attrs','group-truncated','thread-error-late','impersonation-late','admin-reserved','admin-logon','admin-null','admin-absent','admin-enabled','nonadmin-logon')){try{[MathUniverse.G0.FakeNative]::Run($fault)}catch{('TOKEN_CASE_BLOCKED_'+$fault);exit 1}}
foreach($stage in 1..7){foreach($mode in @('probe-success','probe-error','probe-error-zero','probe-zero','probe-huge','read-error','read-error-other','read-grow','read-shrink','alloc-zero','read-stale-error')){try{[MathUniverse.G0.FakeNative]::RunQuery($stage,$mode)}catch{'TOKEN_QUERY_CASE_BLOCKED';exit 1}}}
foreach($stage in 1..3){foreach($mode in @('error','error-zero','anonymous','success-zero','success-invalid','absent')){try{[MathUniverse.G0.FakeNative]::RunThread($stage,$mode)}catch{'TOKEN_THREAD_CASE_BLOCKED';exit 1}}}
foreach($mode in @('query-close','clear-close')){try{[MathUniverse.G0.FakeNative]::RunCombined($mode)}catch{'TOKEN_COMBINED_CASE_BLOCKED';exit 1}}
foreach($r in [MathUniverse.G0.FakeNative]::Results){$r|ConvertTo-Json -Depth 3 -Compress}
'TOKEN_FAULTS_PASS'`;
let out;try{out=execFileSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,TOKEN_PRODUCTION:process.env.TOKEN_CONTROL_SOURCE??fileURLToPath(new URL('../scripts/adminit-containment/WindowsTokenObservation.cs',import.meta.url)),TOKEN_FAKE:fileURLToPath(new URL('./fixtures/token-cleanup/FakeNative.cs',import.meta.url))},encoding:'utf8',timeout:30000,windowsHide:true});}catch(e){const code=String(e.stdout??'').trim();assert.fail(/^TOKEN_(?:COMPILE_BLOCKED|ABI_BLOCKED|CASE_BLOCKED_[a-z-]+)$/.test(code)?code:'TOKEN_FAULT_FIXTURE_BLOCKED');}const lines=out.trim().split(/\r?\n/);assert.equal(lines.pop(),'TOKEN_FAULTS_PASS');assert.equal(lines.length,137);for(const line of lines){const r=validateTokenObservation(JSON.parse(line));assert.equal(r.schema,'math.g0.token-api.v2');assert.equal(r.authority,'NONE');assert.equal(r.localExecute,false);}});
