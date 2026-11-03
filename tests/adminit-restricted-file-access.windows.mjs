import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('unassigned own restricted token AccessCheck distinguishes Admin-only from explicit caller file rights',{
 skip:process.platform!=='win32'?'Windows token/file AccessCheck unavailable; NOT_RUN':false,
},()=>{
 const launcher=readFileSync(new URL('./fixtures/adminit-containment/HostedMediumLauncher.cs',import.meta.url),'utf8');
 const probe=/\/\/ BEGIN_READ_ONLY_ACCESS_PROBE\r?\n([\s\S]*?)\/\/ END_READ_ONLY_ACCESS_PROBE/.exec(launcher)?.[1];
 assert.ok(probe,'actual production read-only probe required');
 const directory=mkdtempSync(join(tmpdir(),'math-restricted-file-access-'));
 try{
  const script="$ErrorActionPreference='Stop';Add-Type -TypeDefinition ('using System;using System.IO;using System.Runtime.InteropServices;'+$env:FILE_ACCESS_PROBE+[IO.File]::ReadAllText($env:FILE_ACCESS_FIXTURE));[OwnRestrictedFileAccessRegression]::Run($env:FILE_ACCESS_ROOT)|ConvertTo-Json -Compress";
  const child=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,FILE_ACCESS_PROBE:probe,FILE_ACCESS_ROOT:directory,FILE_ACCESS_FIXTURE:fileURLToPath(new URL('./fixtures/adminit-containment/RestrictedFileAccessRegression.cs',import.meta.url))},encoding:'utf8',timeout:30000,maxBuffer:4096,windowsHide:true});
  assert.equal(child.error,undefined,'bounded own-file AccessCheck regression');
  assert.equal(child.status,0,'restricted file access regression failed; raw native output withheld');assert.equal(child.stderr,'');
  assert.deepEqual(JSON.parse(child.stdout),{checks:8,adminOnlyDenied:true,callerAllowed:true,handlesClosed:true,fixtureAclRestored:true});
 }finally{rmSync(directory,{recursive:true,force:true});}
});
