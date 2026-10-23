import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('unapproved local queue laboratory invocation is BLOCKED before creating output',()=>{
 const output=join(tmpdir(),'q01-must-not-create-'+process.pid);
 const env={...process.env};delete env.GITHUB_ACTIONS;
 const r=spawnSync(process.execPath,['scripts/q01-lab/run.mjs','--source',process.cwd(),'--output',output,'--expected-head','0'.repeat(40),'--profile','quick'],{env,encoding:'utf8'});
 assert.equal(r.status,2);assert.match(r.stdout,/BLOCKED/);assert.equal(existsSync(output),false);
});
