import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePinnedGitSource} from '../src/ai-orchestrator/pinned-source.mjs';
const candidate={repository:'YehorBabenko88/math',objectFormat:'sha1',commit:'cb168925b5aeec0c957137dd94ab72c64f0bd333',tree:'10cfd29f5d2c75e841d88dd70bef8773dada8287'};
test('candidate SHA1 IDs retain exact bytes without attestation',()=>{
 const r=validatePinnedGitSource(candidate);
 assert.equal(r.commit,candidate.commit);
 assert.equal(r.trust,'UNRESOLVED_OBJECT_IDS');
});
test('reject SHA256-format claim for SHA1 IDs',()=>assert.throws(()=>validatePinnedGitSource({...candidate,objectFormat:'sha256'}),/INVALID_OBJECT_FORMAT/));
test('reject SHA256 tree with SHA1 commit',()=>assert.throws(()=>validatePinnedGitSource({...candidate,tree:'a'.repeat(64)}),/GIT_OBJECT_FORMAT_MISMATCH/));
test('reject wrong repository',()=>assert.throws(()=>validatePinnedGitSource({...candidate,repository:'other/math'}),/REPOSITORY_MISMATCH/));
test('reject abbreviated IDs',()=>assert.throws(()=>validatePinnedGitSource({...candidate,commit:candidate.commit.slice(0,12)}),/GIT_OBJECT_FORMAT_MISMATCH/));
test('reject SHA256 object-format substitution even with 64-character IDs',()=>{
 assert.throws(()=>validatePinnedGitSource({...candidate,objectFormat:'sha256',commit:'a'.repeat(64),tree:'b'.repeat(64)}),/INVALID_OBJECT_FORMAT/);
});

test('reject unknown trust field',()=>assert.throws(()=>validatePinnedGitSource({...candidate,verified:true}),/INVALID_SOURCE/));
test('reject missing tree',()=>{
 const {tree,...rest}=candidate;
 assert.throws(()=>validatePinnedGitSource(rest),/INVALID_SOURCE/);
});
test('reject inherited source properties',()=>{
 const inherited=Object.assign(Object.create({verified:true}),candidate);
 assert.throws(()=>validatePinnedGitSource(inherited),/INVALID_SOURCE/);
});

test('accessor-backed source fields are rejected without invoking getters',()=>{
 let called=false;
 const forged={...candidate};
 Object.defineProperty(forged,'commit',{enumerable:true,get(){called=true;return candidate.commit;}});
 assert.throws(()=>validatePinnedGitSource(forged),/INVALID_SOURCE/);
 assert.equal(called,false);
});
test('non-enumerable source field is rejected',()=>{
 const forged={...candidate};
 Object.defineProperty(forged,'tree',{enumerable:false,value:candidate.tree});
 assert.throws(()=>validatePinnedGitSource(forged),/INVALID_SOURCE/);
});
