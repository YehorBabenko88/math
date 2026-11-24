import test from 'node:test';
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
