import nodeTest from 'node:test';import {platformTests} from '../scripts/ci-platform-cases.mjs';const test=platformTests(import.meta.url,nodeTest);import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
for(const shell of ['powershell.exe','pwsh.exe'])test('CSV complete-row SID and boundary negatives: '+shell,{skip:process.platform!=='win32'?'Windows PowerShell unavailable':false},()=>{const script=String.raw`$ErrorActionPreference='Stop';. $env:G0_CSV_HELPERS
$medium='"Label","Type","S-1-16-8192","Attributes"'
$high='"Label","Type","S-1-16-12288","Attributes"'
$good='"Group ""name"", comma","Group type","S-1-5-21-1","Enabled, status"'
foreach($row in @(
 '"Group","Type","S-1-16-8192;S-1-16-12288","Attributes"',
 '"Group","Type"," S-1-16-8192","Attributes"',
 '"Group","Type","S-1-16-8192""junk","Attributes"',
 '"Group","Type","S-1-16-08192","Attributes"',
 '"Group","Type","S-1-16-4294967296","Attributes"',
 '"Group","Type","S-1-5-21-1","Enabled","EXTRA"',
 '"Group","Type","S-1-5-21-1"',
 '"Group "broken","Type","S-1-5-21-1","Enabled"',
 '"Group","Type","S-1-5-21-1","Enabled',
 $medium,$high)) {
 if((Get-G0TokenObservation ($row+[Environment]::NewLine+$medium) $false) -ne 'UNKNOWN'){throw 'ambiguous or malformed dataset accepted'}
}
if((Get-G0TokenObservation ($good+[Environment]::NewLine+$high) $false) -ne 'FAIL'){throw 'high integrity accepted'}
if((Get-G0TokenObservation ($good+[Environment]::NewLine+$medium) $true) -ne 'FAIL'){throw 'active admin accepted'}
if((Get-G0TokenObservation '"S-1-16-8192","Type","S-1-5-21-1","Attributes"' $false) -ne 'UNKNOWN'){throw 'non-SID column accepted'}
if((Get-G0TokenObservation ($good+[Environment]::NewLine+$medium) $false) -ne 'PASS'){throw 'well-formed quotes rejected'}
'G0_CSV_NEGATIVES_PASS'`;
let text;try{text=execFileSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,G0_CSV_HELPERS:fileURLToPath(new URL('../scripts/adminit-containment/g0-readonly-helpers.ps1',import.meta.url))},encoding:'utf8',windowsHide:true,timeout:15000});}catch{assert.fail('G0_CSV_NEGATIVE_FIXTURE_BLOCKED');}assert.ok(text.trim()==='G0_CSV_NEGATIVES_PASS','unexpected fixture transcript');});
