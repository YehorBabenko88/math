import {runStrictTests} from './test-full-ci.mjs';
import {loadPolicy} from './ci-platform-coverage.mjs';
import assert from 'node:assert/strict';
assert.equal(process.platform,'win32');assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.argv.length,2);
const files=[...new Set(loadPolicy().cases.map(c=>c.file))].sort();
const r=await runStrictTests({files});console.log('Windows native strict result: '+JSON.stringify(r));if(!r.ok)process.exitCode=1;
