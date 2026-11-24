import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('read-only user-object probes use correct mappings and preserve borrowed desktop handles',{
 skip:process.platform!=='win32'?'Windows user-object access regression unavailable; NOT_RUN':false,
},()=>{
 const launcher=readFileSync(new URL('./fixtures/adminit-containment/HostedMediumLauncher.cs',import.meta.url),'utf8');
 const probe=/\/\/ BEGIN_READ_ONLY_USER_OBJECT_PROBE\r?\n([\s\S]*?)\/\/ END_READ_ONLY_USER_OBJECT_PROBE/.exec(launcher)?.[1];
 assert.ok(probe,'actual production read-only user-object probe required');
 assert.doesNotMatch(probe,/SetUserObjectSecurity|SetThreadToken|SetProcessWindowStation|SetThreadDesktop|CreateDesktop|CreateWindowStation|AdjustTokenPrivileges/);
 const script="$ErrorActionPreference='Stop';Add-Type -TypeDefinition ('using System;using System.IO;using System.Runtime.InteropServices;'+$env:USER_OBJECT_PROBE+[IO.File]::ReadAllText($env:USER_OBJECT_FIXTURE));[OwnUserObjectAccessRegression]::Run()|ConvertTo-Json -Compress";
 const child=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,USER_OBJECT_PROBE:probe,USER_OBJECT_FIXTURE:fileURLToPath(new URL('./fixtures/adminit-containment/UserObjectAccessRegression.cs',import.meta.url))},encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:8192});
 assert.equal(child.error,undefined,'bounded read-only user-object regression');
 assert.equal(child.status,0,'user-object regression failed; raw native output withheld');assert.equal(child.stderr,'');
 assert.deepEqual(JSON.parse(child.stdout),{checks:60,mappingsCorrect:true,boundsRejected:true,labelParserBounded:true,borrowedHandlesPreserved:true,duplicateHandlesClosed:true,hostObjectsCreated:0,hostAclsChanged:0});
});
