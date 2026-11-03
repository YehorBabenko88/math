import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {resolve} from 'node:path';
test('bounded read-only loader event correlation never treats publisher PID or unrelated image as child evidence',{
 skip:process.platform!=='win32'?'Windows EventLog unavailable; NOT_RUN':false,
},()=>{
 const script="$ErrorActionPreference='Stop';$r=$env:EVENT_TEST_ROOT;$a=[IO.File]::ReadAllText((Join-Path $r 'tests/fixtures/adminit-containment/HostedLoaderEvents.cs'));$b=[IO.File]::ReadAllText((Join-Path $r 'tests/fixtures/adminit-containment/LoaderEventsRegression.cs'));Add-Type -TypeDefinition ($a+[Environment]::NewLine+$b) -ReferencedAssemblies @('System.dll','System.Core.dll','System.Xml.dll');[MathUniverse.LoaderRegression.OwnLoaderEventsRegression]::Run()";
 const child=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,EVENT_TEST_ROOT:resolve('.')},encoding:'utf8',timeout:15000,maxBuffer:2048,windowsHide:true});
 assert.equal(child.error,undefined);assert.equal(child.status,0,'read-only event regression failed; raw local metadata withheld');assert.equal(child.stderr,'');assert.equal(child.stdout.trim(),'READ_ONLY_EVENT_CORRELATION_PASSED');
});
