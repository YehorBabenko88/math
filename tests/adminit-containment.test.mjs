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
