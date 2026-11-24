import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('own unassigned restricted token requires adjust-default access to set Medium integrity',{
 skip:process.platform!=='win32'?'Windows token access regression unavailable; NOT_RUN':false,
},()=>{
 const launcher=readFileSync(new URL('./fixtures/adminit-containment/HostedMediumLauncher.cs',import.meta.url),'utf8');
 const expression=/OpenProcessToken\(GetCurrentProcess\(\),([^,]+),out token\)/.exec(launcher)?.[1];
 assert.match(expression??'',/^11(?:\|0x80)?$/);
 const access=expression.split('|').reduce((value,part)=>value|Number(part),0);
 const script="$ErrorActionPreference='Stop';Add-Type -TypeDefinition ([IO.File]::ReadAllText($env:INTEGRITY_ACCESS_SOURCE));[MathTokenAccessRegression]::Run("+access+")|ConvertTo-Json -Compress";
 const child=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{
  env:{...process.env,INTEGRITY_ACCESS_SOURCE:fileURLToPath(new URL('./fixtures/adminit-containment/TokenIntegrityAccessRegression.cs',import.meta.url))},
  encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4096,
 });
 assert.equal(child.error,undefined,'bounded own-token regression process');
 assert.equal(child.status,0,'own-token regression failed; raw native output withheld');
 assert.equal(child.stderr,'','closed regression stderr');
 const result=JSON.parse(child.stdout);
 assert.deepEqual(result,{oldError:5,productionSuccess:true,restrictedIntegrity:8192,callerUnchanged:true,handlesClosed:true,processesCreated:0,tokensAssigned:0});
});
