import nodeTest from 'node:test';import {platformTests} from '../scripts/ci-platform-cases.mjs';const test=platformTests(import.meta.url,nodeTest);import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
for(const shell of ['powershell.exe','pwsh.exe'])test('compiled AdminState flag semantics: '+shell,{skip:process.platform!=='win32'?'Windows compiler unavailable':false},()=>{const script=String.raw`$ErrorActionPreference='Stop';[void](Add-Type -TypeDefinition ([IO.File]::ReadAllText($env:FLAGS_SOURCE)) -ErrorAction Stop)
if([MathUniverse.G0.TokenPolicy]::AdminState(1,128) -ne -1){throw 'reserved 0x80 accepted'}
foreach($v in @(0,1,2,3,8,9,10,11,16,17,18,19,24,25,26,27)){if([MathUniverse.G0.TokenPolicy]::AdminState(1,[uint32]$v) -ne 0){throw 'disabled or deny-only rejected'}}
foreach($v in @(4,5,6,7,12,13,14,15)){if([MathUniverse.G0.TokenPolicy]::AdminState(1,[uint32]$v) -ne 1){throw 'enabled admin misclassified'}}
foreach($v in @(20,21,22,23,28,29,30,31,32,64,128,144,536870912,1073741824,2147483648,3221225472,4294967295)){if([MathUniverse.G0.TokenPolicy]::AdminState(1,[uint32]$v) -ne -1){throw 'wrong-context flags accepted'}}
if([MathUniverse.G0.TokenPolicy]::AdminState(0,0) -ne 0){throw 'absent admin rejected'}
foreach($count in @(0,2,3)){if([MathUniverse.G0.TokenPolicy]::AdminState([uint32]$count,16) -ne -1){throw 'ambiguous count'}}
$sid=[byte[]]@(1,1,0,0,0,0,0,16,0,32,0,0)
foreach($attrs in @(16,17,18,19,24,25,26,27)){$state=[MathUniverse.G0.TokenPolicy]::AdminState(1,[uint32]$attrs);$r=[MathUniverse.G0.TokenPolicy]::Evaluate($sid,32,0,1,($state -eq 1),$true);if($r.status -ne 'PASS' -or $r.localExecute -or $r.isolationConfirmed -or $r.admission -ne 'BLOCKED'){throw 'Medium deny-only policy changed'}}
'FLAGS_PURE_PASS'`;
let out;try{out=execFileSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,FLAGS_SOURCE:process.env.FLAGS_CONTROL_SOURCE??fileURLToPath(new URL('../scripts/adminit-containment/WindowsTokenObservation.cs',import.meta.url))},encoding:'utf8',timeout:30000,windowsHide:true});}catch{assert.fail('ADMIN_FLAGS_PURE_BLOCKED');}assert.ok(out.trim()==='FLAGS_PURE_PASS');});
