import nodeTest from 'node:test';import {platformTests} from '../scripts/ci-platform-cases.mjs';const test=platformTests(import.meta.url,nodeTest);import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
for(const shell of ['powershell.exe','pwsh.exe'])test('physical anonymous quote-shape and canonical RFC counterpart: '+shell,{skip:process.platform!=='win32'?'Windows PowerShell unavailable':false},()=>{const script=String.raw`$ErrorActionPreference='Stop';. $env:G0_CSV_HELPERS
$bad='"Synthetic group "unescaped"","Group type","S-1-5-21-1","Enabled, status"'
$good='"Synthetic group ""escaped""","Group type","S-1-5-21-1","Enabled, status"'
$medium='"Label","Type","S-1-16-8192","Attributes"'
if($bad.ToCharArray().Where({$_ -eq [char]34}).Count -ne 10){throw 'bad fixture shape'}
$loose=$bad|ConvertFrom-Csv -Header Name,Type,Sid,Attributes
if(@($loose.PSObject.Properties).Count -ne 4){throw 'lenient behavior changed'}
if((Get-G0TokenObservation ($bad+[Environment]::NewLine+$medium) $false) -ne 'UNKNOWN'){throw 'malformed producer row accepted'}
if((Get-G0TokenObservation ($good+[Environment]::NewLine+$medium) $false) -ne 'PASS'){throw 'valid RFC quoted field rejected'}
'G0_QUOTE_SHAPE_PASS'`;
let text;try{text=execFileSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,G0_CSV_HELPERS:fileURLToPath(new URL('../scripts/adminit-containment/g0-readonly-helpers.ps1',import.meta.url))},encoding:'utf8',windowsHide:true,timeout:15000});}catch{assert.fail('G0_QUOTE_SHAPE_FIXTURE_BLOCKED');}assert.ok(text.trim()==='G0_QUOTE_SHAPE_PASS','unexpected fixture transcript');});
