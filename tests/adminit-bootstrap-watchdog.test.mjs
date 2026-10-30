import nodeTest from 'node:test';import {platformTests} from '../scripts/ci-platform-cases.mjs';const test=platformTests(import.meta.url,nodeTest);
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('production deadline and cleanup guards remain present',()=>{
 const launcher=readFileSync(new URL('./fixtures/adminit-containment/HostedMediumLauncher.cs',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../.github/workflows/adminit-synthetic-containment.yml',import.meta.url),'utf8');
 assert.match(launcher,/Check\(k.Wait\(p,120000\)==0,/);
 assert.match(launcher,/k.TerminateJob\(job\);Check\(k.WaitJobEmpty\(job,5000\)/);
 assert.match(launcher,/bootstrap owned handle close failed/);
 assert.match(workflow,/if \(-not \$owner.WaitForExit\(150000\)\)/);
});
test('bootstrap deadline cleanup source and PowerShell branch MODEL mocks',{
 skip:process.platform!=='win32'?'Windows PowerShell model compilation requires Windows; native qualification remains BLOCKED':false,
},t=>{
 const directory=mkdtempSync(join(tmpdir(),'bootstrap-watchdog-model-'));
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const evidencePath=join(directory,'bootstrap-watchdog-model.json');
 const run=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',join(root,'tests/adminit-bootstrap-watchdog.mock.ps1'),'-EvidencePath',evidencePath],{encoding:'utf8',cwd:root,timeout:30000,windowsHide:true});
 assert.ok(!run.error,'PowerShell model process failed or exceeded 30 second bound');
 assert.equal(run.status,0,'PowerShell model assertions failed; raw child output omitted');
 assert.ok(/PASS: 9 bootstrap source-fragment mock cases/.test(run.stdout),'Bootstrap case summary missing');
 assert.ok(/PASS: four PowerShell watchdog timeout paths/.test(run.stdout),'PowerShell case summary missing');
 const evidence=JSON.parse(readFileSync(evidencePath,'utf8'));
 assert.equal(evidence.nativeExpiryHosted,'BLOCKED');
 assert.equal(evidence.nativeCalls,0);
 assert.equal(evidence.bootstrapDeadlineMs,120000);
 assert.equal(evidence.powershellDeadlineMs,150000);
 assert.equal(evidence.bootstrapCases.length,9);
});
