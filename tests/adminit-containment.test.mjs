import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('ADMINIT gate remains closed pending independent isolation criteria',()=>{
 const s=read('scripts/adminit-containment/verify-adminit.ps1');
 assert.match(s,/ADMINIT isolation criteria not integrated: BLOCKED/);
 assert.doesNotMatch(s,/Set-ExecutionPolicy|Set-Acl|Set-NetFirewall|Restart-Service|Start-Service|Invoke-Expression/);
});
test('existing hosted-only fixture and helper bytes remain pinned',()=>{
 for(const[p,h]of [['scripts/q01-lab/WindowsJobContainment.cs','0dd48d9b8413f8374284273659d3e4aa14ad66574992cfdeac4c22701dd4a18f'],['tests/fixtures/windows-containment/NativeHarness.cs','1aeab3620dd89a9861f7518e710624d06a7890e9931e3abdb5b59a68912dcfb0']])assert.equal(createHash('sha256').update(read(p).replaceAll('\r\n','\n')).digest('hex'),h);
 const s=read('tests/fixtures/windows-containment/NativeHarness.cs');assert.match(s,/HostedOnly\(\)/);assert.match(s,/github-hosted/);
});
test('ADMINIT fixture is fixed, Medium-only and supervised by owned handles',()=>{
 const s=read('tests/fixtures/adminit-containment/AdminitSynthetic.cs');
 for(const token of ['AssertMedium','WaitForSingleObject','GetProcessTimes','ConfigureKillOnClose','WaitJobEmpty','--owner','--leaf','--root'])assert.ok(s.includes(token),token);
 assert.doesNotMatch(s,/Process\.Start|cmd\.exe|powershell\.exe|SqlConnection|HttpClient|WebClient|ServiceController|Process\.Kill/);
});

test('ADMINIT read-only verifier rejects execute before any package access',()=>{
 const s=read('scripts/adminit-containment/verify-adminit.ps1');
 const guard=s.indexOf("if($Execute){throw 'ADMINIT isolation criteria not integrated: BLOCKED; no local process may launch'}");
 const packageCheck=s.indexOf("& $node (Join-Path $PSScriptRoot 'package.mjs')");
 assert.ok(guard>=0&&packageCheck>guard,'Execute must fail closed before package verification');
 assert.doesNotMatch(s,/Start-Process|Invoke-Command|New-Service|Set-ExecutionPolicy|Set-Acl|Set-NetFirewallRule/);
});

test('native report validation is explicitly limited to hosted synthetic evidence',()=>{
 const s=read('scripts/adminit-containment/verify-native.mjs');
 assert.match(s,/BLOCKED_PENDING_ISOLATION_REVIEW/);
 assert.match(s,/not filesystem\/network isolation or physical authorization/);
 assert.match(s,/sourceHead===sourceHead&&r.sourceTree===sourceTree/);
});

test('PowerShell watchdog refuses unconfirmed kill and does not equate root exit with descendant drain',()=>{
 const workflow=read('.github/workflows/adminit-synthetic-containment.yml');
 assert.match(workflow,/if \(-not \$owner\.WaitForExit\(5000\) -or -not \$owner\.HasExited\)/);
 assert.match(workflow,/independent watchdog cleanup unconfirmed: BLOCKED/);
 assert.match(workflow,/descendant status unknown/);
 assert.doesNotMatch(workflow,/\$owner\.WaitForExit\(5000\) \| Out-Null/);
});

test('bootstrap watchdog distinguishes timeout and failed waits from signalled completion',()=>{
 const source=read('tests/fixtures/adminit-containment/HostedMediumLauncher.cs');
 assert.match(source,/k\.Wait\(p,120000\)==0/);
 assert.match(source,/bootstrap descendant drain unconfirmed/);
 assert.match(source,/k\.WaitJobEmpty\(job,5000\)/);
 assert.match(source,/unassigned supervisor cleanup unconfirmed/);
});
test('native wait wrapper preserves raw Win32 wait status for fail-closed callers',()=>{
 const source=read('scripts/q01-lab/WindowsJobContainment.cs');
 assert.match(source,/return WaitForSingleObject\(process,milliseconds\)/);
 assert.match(source,/native\.Wait\(process, CleanupMilliseconds\)!=0/);
});

test('watchdog reports unconfirmed cleanup without claiming descendants are drained',()=>{
 const workflow=read('.github/workflows/adminit-synthetic-containment.yml');
 assert.match(workflow,/descendant status unknown/);
 assert.match(workflow,/if \(-not \$owner\.WaitForExit\(5000\) -or -not \$owner\.HasExited\)/);
 const source=read('tests/fixtures/adminit-containment/HostedMediumLauncher.cs');
 assert.match(source,/k\.WaitJobEmpty\(job,5000\)/);
 assert.match(source,/bootstrap descendant drain unconfirmed/);
});

test('ADMINIT physical execution guard remains closed despite watchdog changes',()=>{
 const guard=read('scripts/adminit-containment/verify-adminit.ps1');
 assert.match(guard,/if\(\$Execute\)\{throw 'ADMINIT isolation criteria not integrated: BLOCKED; no local process may launch'\}/);
 const workflow=read('.github/workflows/adminit-synthetic-containment.yml');
 assert.match(workflow,/independent whole-fixture watchdog expired: BLOCKED, never PASS/);
 assert.doesNotMatch(workflow,/verify-adminit\.ps1[^\n]*-Execute/);
});

test('five hosted native scenarios remain mandatory and synthetic-only',()=>{
 const verifier=read('scripts/adminit-containment/verify-native.mjs');
 assert.match(verifier,/\['normal','timeout','crash','assignment','cleanup'\]/);
 assert.match(verifier,/r\[key\]\.length===cases\.length/);
 assert.match(verifier,/c\.status==='PASS'/);
 assert.match(verifier,/BLOCKED_PENDING_ISOLATION_REVIEW/);
});

test('native evidence rejects a missing or duplicate scenario before accepting report',()=>{
 const verifier=read('scripts/adminit-containment/verify-native.mjs');
 assert.match(verifier,/new Set\(r\[key\]\.map\(x=>x\?\.scenario\)\)\.size===cases\.length/);
 assert.match(verifier,/r\[key\]\.every\(x=>cases\.includes\(x\?\.scenario\)\)/);
 assert.match(verifier,/exact '\+key\+' inventory/);
});
