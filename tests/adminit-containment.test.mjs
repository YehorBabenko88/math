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
