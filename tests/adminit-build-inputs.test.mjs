import test from 'node:test';import assert from 'node:assert/strict';import{requiredInputs,validateBuildEntries}from'../scripts/adminit-containment/verify-build-inputs.mjs';
const entries=()=>requiredInputs.map(path=>({path,mode:'100644',type:'blob'}));
test('build input policy accepts exactly committed regular source inputs',()=>assert.equal(validateBuildEntries(entries()),true));
test('build input policy rejects an untracked/missing fixture',()=>{const e=entries();e.pop();assert.throws(()=>validateBuildEntries(e),/BLOCKED/);});
for(const mode of ['120000','160000'])test('build input policy rejects mode '+mode,()=>{const e=entries();e[0]={...e[0],mode,type:mode==='160000'?'commit':'blob'};assert.throws(()=>validateBuildEntries(e),/BLOCKED/);});
test('build input policy rejects duplicated input identities',()=>{const e=entries();e[0]=e[1];assert.throws(()=>validateBuildEntries(e),/BLOCKED/);});
