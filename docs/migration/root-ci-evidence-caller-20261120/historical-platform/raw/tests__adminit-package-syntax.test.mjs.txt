import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('qualified package module must parse before any candidate verification',()=>{const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../scripts/adminit-containment/package.mjs',import.meta.url))],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(result.status,0,'qualified verifier syntax');});
