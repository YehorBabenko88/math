import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('ADMINIT contract test module parses before its assertions are trusted',()=>{
 const file=fileURLToPath(new URL('./adminit-containment.test.mjs',import.meta.url));
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(result.error,undefined);
 assert.equal(result.status,0,'contract module syntax check failed');
});
