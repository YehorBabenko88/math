import test from 'node:test';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
for(const shell of ['powershell.exe','pwsh.exe'])test('pure G0 token/ACL fixtures: '+shell,{skip:process.platform!=='win32'?'Windows PowerShell unavailable; pure fixtures NOT_RUN':false},()=>{const script=String.raw`$ErrorActionPreference='Stop';. $env:G0_PURE_HELPERS
$fake='"S-1-16-8192","Group","S-1-5-21-1","Enabled"'
# Reproduce the old whole-text classification without querying a machine.
$old=@([regex]::Matches($fake,'S-1-16-[0-9]+')|ForEach-Object {$_.Value}|Select-Object -Unique)
if($old.Count -ne 1 -or $old[0] -ne 'S-1-16-8192'){throw 'old defect not reproduced'}
if((Get-G0TokenObservation $fake $false) -ne 'UNKNOWN'){throw 'display-name spoof accepted'}
$medium='"Label","Type","S-1-16-8192","Attributes"'
$high='"Label","Type","S-1-16-12288","Attributes"'
$low='"Label","Type","S-1-16-4096","Attributes"'
if((Get-G0TokenObservation $medium $false) -ne 'PASS'){throw 'medium failed'}
foreach($row in @($high,$low)){if((Get-G0TokenObservation $row $false) -ne 'FAIL'){throw 'wrong integrity accepted'}}
if((Get-G0TokenObservation $medium $true) -ne 'FAIL'){throw 'enabled admin accepted'}
if((Get-G0TokenObservation ($medium+[Environment]::NewLine+$high) $false) -ne 'UNKNOWN'){throw 'ambiguous labels accepted'}
if((Get-G0TokenObservation 'malformed' $false) -ne 'UNKNOWN'){throw 'malformed accepted'}
$paths=@(Get-G0AclInspectionPaths 'C:\Synthetic\accept' 'C:\Synthetic\accept\a\b\checkout')
if($paths.Count -ne 4 -or $paths[1] -ne 'C:\Synthetic\accept\a' -or $paths[2] -ne 'C:\Synthetic\accept\a\b'){throw 'intermediate ACL gap'}
$rejected=$false;try{[void](Get-G0AclInspectionPaths 'C:\Synthetic\accept' 'C:\Synthetic\outside')}catch{$rejected=$true};if(-not $rejected){throw 'scope escape'}
'G0_PURE_FIXTURES_PASS'`;
let text;try{text=execFileSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,G0_PURE_HELPERS:fileURLToPath(new URL('../scripts/adminit-containment/g0-readonly-helpers.ps1',import.meta.url))},encoding:'utf8',windowsHide:true,timeout:15000});}catch{assert.fail('G0_PURE_FIXTURES_BLOCKED');}assert.ok(text.trim()==='G0_PURE_FIXTURES_PASS','G0 fixture transcript rejected');});
