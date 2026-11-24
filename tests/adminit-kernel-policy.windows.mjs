import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('read-only job mitigation and kernel DACL probes preserve existing handles and reject generic ACEs',{
 skip:process.platform!=='win32'?'Windows kernel policy regression unavailable; NOT_RUN':false,
},()=>{
 const launcher=readFileSync(new URL('./fixtures/adminit-containment/HostedMediumLauncher.cs',import.meta.url),'utf8');
 const ui=/\/\/ BEGIN_READ_ONLY_USER_OBJECT_PROBE\r?\n([\s\S]*?)\/\/ END_READ_ONLY_USER_OBJECT_PROBE/.exec(launcher)?.[1];
 const probe=/\/\/ BEGIN_READ_ONLY_KERNEL_POLICY_PROBE\r?\n([\s\S]*?)\/\/ END_READ_ONLY_KERNEL_POLICY_PROBE/.exec(launcher)?.[1];
 assert.ok(ui&&probe,'actual production read-only kernel probe required');
 assert.doesNotMatch(probe,/SetKernelObjectSecurity|SetTokenInformation|SetInformationJobObject|SetProcessMitigationPolicy|CreateProcess|AssignProcessToJobObject|ResumeThread|AdjustTokenPrivileges/);
 const script="$ErrorActionPreference='Stop';Add-Type -TypeDefinition ('using System;using System.IO;using System.Runtime.InteropServices;'+$env:KERNEL_PROBE+[IO.File]::ReadAllText($env:KERNEL_FIXTURE));[OwnKernelPolicyRegression]::Run()|ConvertTo-Json -Compress";
 const child=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,KERNEL_PROBE:ui+'\n'+probe,KERNEL_FIXTURE:fileURLToPath(new URL('./fixtures/adminit-containment/KernelPolicyAccessRegression.cs',import.meta.url))},encoding:'utf8',timeout:30000,maxBuffer:8192,windowsHide:true});
 assert.equal(child.error,undefined,'bounded read-only kernel policy regression');assert.equal(child.status,0,'kernel policy regression failed; raw native output withheld');assert.equal(child.stderr,'');
 assert.deepEqual(JSON.parse(child.stdout),{checks:14,genericRejected:true,unsupportedAceRejected:true,boundsRejected:true,jobReadOnly:true,mitigationBounded:true,borrowedHandlesPreserved:true,ownedHandlesClosed:true,createdProcesses:0,assignedTokens:0,changedLimits:0});
});
