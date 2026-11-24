import test from 'node:test';import assert from 'node:assert/strict';import{validateZipMemberNames}from '../scripts/adminit-containment/zip-members.mjs';
const names=['AdminitSyntheticHarness.exe','package.json'];
test('expected names do not grant extraction',()=>{const r=validateZipMemberNames(names);assert.equal(r.extraction,'DENIED');});
for(const bad of ['../package.json','/package.json','C:package.json','package.json:stream','sub/package.json','sub\\package.json','package.json\0','PACKAGE.JSON'])test('reject '+JSON.stringify(bad),()=>assert.throws(()=>validateZipMemberNames([names[0],bad]),/ZIP_MEMBERS_INVALID/));
test('reject duplicate entry',()=>assert.throws(()=>validateZipMemberNames([names[0],names[0]]),/ZIP_MEMBERS_INVALID/));
test('reject extra entries',()=>assert.throws(()=>validateZipMemberNames([...names,'extra']),/ZIP_MEMBERS_INVALID/));
