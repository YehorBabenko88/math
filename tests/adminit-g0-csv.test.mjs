import nodeTest from 'node:test';import {platformTests} from '../scripts/ci-platform-cases.mjs';const test=platformTests(import.meta.url,nodeTest);import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
for(const shell of ['powershell.exe','pwsh.exe'])test('13-line CSV with one escaped quote: '+shell,{skip:process.platform!=='win32'?'Windows PowerShell unavailable':false},()=>{const script=String.raw`$ErrorActionPreference='Stop';. $env:G0_CSV_HELPERS
$quoted='"Synthetic group ""quoted","Group","S-1-5-21-1","Enabled"'
$rows=@();for($i=0;$i -lt 11;$i++){$rows+='"Group","Type","S-1-5-21-2","Enabled"'}
$rows+=$quoted;$rows+='"Label","Type","S-1-16-8192","Attributes"'
if($quoted.ToCharArray().Where({$_ -eq [char]34}).Count -ne 10){throw 'fixture shape'}
if((Get-G0TokenObservation ($rows -join [Environment]::NewLine) $false) -ne 'PASS'){throw 'escaped CSV rejected'}
'G0_CSV_PASS'`;
let text;try{text=execFileSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,G0_CSV_HELPERS:fileURLToPath(new URL('../scripts/adminit-containment/g0-readonly-helpers.ps1',import.meta.url))},encoding:'utf8',windowsHide:true,timeout:15000});}catch{assert.fail('G0_CSV_FIXTURE_BLOCKED');}assert.ok(text.trim()==='G0_CSV_PASS','unexpected fixture transcript');});
