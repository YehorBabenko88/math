import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./fixtures/adminit-containment/AdminitSynthetic.cs',import.meta.url),'utf8');

test('hosted native fixture never prints full results.json to Actions console',()=>{
 assert.doesNotMatch(source,/Console\.WriteLine\(File\.ReadAllText\(Path\.Combine\(Suite,\s*"results\.json"\)\)\)/);
 assert.match(source,/Console\.WriteLine\(ok\?"ADMINIT_HOSTED_NATIVE_REPORT_WRITTEN":"ADMINIT_HOSTED_NATIVE_REPORT_FAILED"\)/);
});
test('full native evidence remains a file for independent private verification',()=>{
 assert.match(source,/Write\(Path\.Combine\(Suite,\s*"results\.json"\)/);
});
