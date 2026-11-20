import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=new URL('../scripts/q01-lab/WindowsJobContainment.cs',import.meta.url);
test('native containment uses suspended assignment and bounded cleanup, without breakaway',()=>{
 const code=readFileSync(file,'utf8');
 assert.match(code,/CREATE_SUSPENDED/);
 assert.match(code,/JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
 assert.ok(code.indexOf('native.Assign(job, process)')<code.indexOf('native.Resume(thread)'));
 assert.match(code,/finally/);
 assert.match(code,/native.TerminateJob\(job\)/);
 assert.match(code,/native.TerminateProcess\(process\)/);
 assert.match(code,/native.Wait\(process, CleanupMilliseconds\)/);
 assert.doesNotMatch(code,/CREATE_BREAKAWAY_FROM_JOB|JOB_OBJECT_LIMIT_BREAKAWAY_OK/);
});
test('public entry point remains fail closed before native compilation',()=>{
 const ps=readFileSync(new URL('../scripts/windows-q01-lab.ps1',import.meta.url),'utf8');
 assert.match(ps,/throw 'execution containment unavailable: BLOCKED/);
 assert.doesNotMatch(ps.replace(/^\s*#.*$/gm,''),/Add-Type|WindowsJobContainment/);
});
test('hosted shell profiles use a literal launcher and preserve native exit codes',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/q01-windows-containment-preparation.yml',import.meta.url),'utf8');
 assert.doesNotMatch(workflow,/shell:\s*\$\{\{/);
 assert.match(workflow,/& '\$\{\{ matrix.shell \}\}' -NoProfile -File tests\/windows-job-containment.mock.ps1/);
 assert.match(workflow,/exit \$LASTEXITCODE/);
});
