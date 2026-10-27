import{validateTokenObservation}from'../scripts/adminit-containment/token-contract.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
for(const shell of ['powershell.exe','pwsh.exe'])test('Token API compile and synthetic policy only: '+shell,{skip:process.platform!=='win32'?'Windows compiler unavailable; NOT live API qualification':false},()=>{const script=String.raw`$ErrorActionPreference='Stop'
foreach($path in @($env:G0_TOKEN_WRAPPER,$env:G0_TOKEN_CLI,$env:G0_COLLECTOR)){$tokens=$null;$errors=$null;[void][System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'wrapper parser'}}
[void](Add-Type -TypeDefinition ([IO.File]::ReadAllText($env:G0_TOKEN_SOURCE)) -ErrorAction Stop)
$sid=[byte[]]@(1,1,0,0,0,0,0,16,0,32,0,0)
$r=[MathUniverse.G0.TokenPolicy]::Evaluate($sid,32,0,1,$false,$true)
if($r.status -ne 'PASS' -or $r.localExecute -or $r.isolationConfirmed -or $r.admission -ne 'BLOCKED'){throw 'medium policy'}
foreach($rid in @(4096,12288)){$s=$sid.Clone();[Array]::Copy([BitConverter]::GetBytes([uint32]$rid),0,$s,8,4);if([MathUniverse.G0.TokenPolicy]::Evaluate($s,32,0,1,$false,$true).status -ne 'FAIL'){throw 'integrity rejection'}}
foreach($s in @([byte[]]@(),[byte[]]@(1,2,0,0,0,0,0,16,0,32,0,0),[byte[]]@(1,1,0,0,0,0,0,5,0,32,0,0),[byte[]]@(2,1,0,0,0,0,0,16,0,32,0,0))){if([MathUniverse.G0.TokenPolicy]::Evaluate($s,32,0,1,$false,$true).status -ne 'UNKNOWN'){throw 'malformed SID'}}
if([MathUniverse.G0.TokenPolicy]::Evaluate($sid,32,1,1,$false,$true).status -ne 'FAIL'){throw 'elevated accepted'}
if([MathUniverse.G0.TokenPolicy]::Evaluate($sid,32,0,1,$true,$true).status -ne 'FAIL'){throw 'admin accepted'}
foreach($r in @([MathUniverse.G0.TokenPolicy]::Evaluate($sid,0,0,1,$false,$true),[MathUniverse.G0.TokenPolicy]::Evaluate($sid,32,2,1,$false,$true),[MathUniverse.G0.TokenPolicy]::Evaluate($sid,32,0,2,$false,$true),[MathUniverse.G0.TokenPolicy]::Evaluate($sid,32,0,1,$false,$false),[MathUniverse.G0.TokenPolicy]::Unavailable('E_QUERY'))){if($r.status -ne 'UNKNOWN' -or $r.integrityRid -ne $null -or $r.elevated -ne $null -or $r.adminEnabled -ne $null){throw 'ambiguous API result'}}
if([MathUniverse.G0.TokenPolicy]::AdminState(0,0) -ne 0 -or [MathUniverse.G0.TokenPolicy]::AdminState(1,4) -ne 1 -or [MathUniverse.G0.TokenPolicy]::AdminState(1,16) -ne 0){throw 'admin flags'}
foreach($state in @([MathUniverse.G0.TokenPolicy]::AdminState(2,4),[MathUniverse.G0.TokenPolicy]::AdminState(1,20),[MathUniverse.G0.TokenPolicy]::AdminState(0,4),[MathUniverse.G0.TokenPolicy]::AdminState(1,32),[MathUniverse.G0.TokenPolicy]::AdminState(1,64),[MathUniverse.G0.TokenPolicy]::AdminState(1,128),[MathUniverse.G0.TokenPolicy]::AdminState(1,144),[MathUniverse.G0.TokenPolicy]::AdminState(1,2147483648),[MathUniverse.G0.TokenPolicy]::AdminState(1,1073741824),[MathUniverse.G0.TokenPolicy]::AdminState(1,3221225472))){if($state -ne -1){throw 'ambiguous admin flags'}}
# Never invoke WindowsTokenAdapter.Observe or any P/Invoke from a test.
[MathUniverse.G0.TokenPolicy]::Evaluate($sid,32,0,1,$false,$true)|ConvertTo-Json -Compress
[MathUniverse.G0.TokenPolicy]::Unavailable('E_QUERY')|ConvertTo-Json -Compress
. $env:G0_TOKEN_WRAPPER
# Already-compiled types force the preloaded-type guard; this cannot query a token.
$blocked=Get-G0StructuredTokenObservation
if($blocked.code -ne 'E_LOAD' -or $blocked.diagnosticStage -ne 'LOAD' -or $blocked.localExecute){throw 'loader diagnostics'}
$blocked|ConvertTo-Json -Compress
'G0_TOKEN_COMPILE_POLICY_PASS'`;
let out;try{out=execFileSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,G0_TOKEN_SOURCE:fileURLToPath(new URL('../scripts/adminit-containment/WindowsTokenObservation.cs',import.meta.url)),G0_COLLECTOR:fileURLToPath(new URL('../scripts/adminit-containment/collect-g0.ps1',import.meta.url)),G0_TOKEN_WRAPPER:fileURLToPath(new URL('../scripts/adminit-containment/g0-token-api.ps1',import.meta.url)),G0_TOKEN_CLI:fileURLToPath(new URL('../scripts/adminit-containment/observe-token-api.ps1',import.meta.url))},encoding:'utf8',windowsHide:true,timeout:30000});}catch{assert.fail('G0_TOKEN_COMPILE_POLICY_BLOCKED');}const lines=out.trim().split(/\r?\n/);assert.ok(lines.length===4&&lines[3]==='G0_TOKEN_COMPILE_POLICY_PASS','unsafe compiler transcript');for(const [index,status]of [[0,'PASS'],[1,'UNKNOWN'],[2,'UNKNOWN']])assert.equal(validateTokenObservation(JSON.parse(lines[index])).status,status);});
