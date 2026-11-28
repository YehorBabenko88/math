import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyCurrentSourceFiles} from '../scripts/platform-source-transfer.mjs';
test('new test sources extend exact custody without rewriting the historical ledger',()=>{
 const result=verifyCurrentSourceFiles();
 assert.equal(Object.keys(result.files).length,210);
 assert.ok(Object.hasOwn(result.extension.files,'tests/math-universe-research-bridge.test.mjs'));
 for(const path of Object.keys(result.extension.files))assert.throws(()=>verifyCurrentSourceFiles({read:p=>p===path?Buffer.from('substitution'):readFileSync(p)}),/bytes changed/);
});
