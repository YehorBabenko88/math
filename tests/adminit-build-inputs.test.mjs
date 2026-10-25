import test from 'node:test';import assert from 'node:assert/strict';import{requiredInputs,validateBuildEntries}from'../scripts/adminit-containment/verify-build-inputs.mjs';
const entries=()=>requiredInputs.map(path=>({path,mode:'100644',type:'blob',oid:'a'.repeat(40)}));
test('build input policy accepts exactly committed regular source inputs',()=>assert.equal(validateBuildEntries(entries()),true));
test('build input policy rejects an untracked/missing fixture',()=>{const e=entries();e.pop();assert.throws(()=>validateBuildEntries(e),/BLOCKED/);});
for(const mode of ['120000','160000'])test('build input policy rejects mode '+mode,()=>{const e=entries();e[0]={...e[0],mode,type:mode==='160000'?'commit':'blob'};assert.throws(()=>validateBuildEntries(e),/BLOCKED/);});
test('build input policy rejects duplicated input identities',()=>{const e=entries();e[0]=e[1];assert.throws(()=>validateBuildEntries(e),/BLOCKED/);});

test('build input policy rejects abbreviated blob OID',()=>{const e=entries();e[0]={...e[0],oid:'a'.repeat(12)};assert.throws(()=>validateBuildEntries(e),/BLOCKED/);});
test('build input policy rejects SHA256 object ID in SHA1 repository',()=>{const e=entries();e[0]={...e[0],oid:'b'.repeat(64)};assert.throws(()=>validateBuildEntries(e),/BLOCKED/);});
test('build input policy rejects missing blob identity',()=>{const e=entries();delete e[0].oid;assert.throws(()=>validateBuildEntries(e),/BLOCKED/);});

test('committed Git tree parser preserves full OID and correct path capture groups',async()=>{
 const {execFileSync}=await import('node:child_process');
 const {verifyCommittedBuildInputs}=await import('../scripts/adminit-containment/verify-build-inputs.mjs');
 const head=execFileSync('git',['--no-replace-objects','-c','core.fsmonitor=false','rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 assert.equal(verifyCommittedBuildInputs(head),true);
});
