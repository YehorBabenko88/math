import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('ADMINIT gate remains closed pending independent isolation criteria',()=>{
 const s=read('scripts/adminit-containment/verify-adminit.ps1');
 assert.match(s,/ADMINIT isolation criteria not integrated: BLOCKED/);
 assert.doesNotMatch(s,/Set-ExecutionPolicy|Set-Acl|Set-NetFirewall|Restart-Service|Start-Service|Invoke-Expression/);
});
test('existing hosted-only fixture and helper bytes remain pinned',()=>{
 for(const[p,h]of [['scripts/q01-lab/WindowsJobContainment.cs','0dd48d9b8413f8374284273659d3e4aa14ad66574992cfdeac4c22701dd4a18f'],['tests/fixtures/windows-containment/NativeHarness.cs','76d92b38006bc351c4abb957fe2e19a9fd053d0923b09445884caf43a5dae1d7']])assert.equal(createHash('sha256').update(read(p).replaceAll('\r\n','\n')).digest('hex'),h);
 const s=read('tests/fixtures/windows-containment/NativeHarness.cs');assert.match(s,/HostedOnly\(\)/);assert.match(s,/github-hosted/);
});
test('ADMINIT fixture is fixed, Medium-only and supervised by owned handles',()=>{
 const s=read('tests/fixtures/adminit-containment/AdminitSynthetic.cs');
 for(const token of ['AssertMedium','WaitForSingleObject','GetProcessTimes','ConfigureKillOnClose','WaitJobEmpty','--owner','--leaf','--root'])assert.ok(s.includes(token),token);
 assert.doesNotMatch(s,/Process\.Start|cmd\.exe|powershell\.exe|SqlConnection|HttpClient|WebClient|ServiceController|Process\.Kill/);
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
