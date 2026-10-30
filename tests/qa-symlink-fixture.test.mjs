import test from 'node:test';
import assert from 'node:assert/strict';
import {createSymlinkFixture} from './helpers/qa-symlink-fixture.mjs';

test('symlink fixture policy records successful creation without skipping',()=>{
 const calls=[],skips=[];
 assert.equal(createSymlinkFixture({skip:r=>skips.push(r)},'target','link','file',{platform:'win32',create:(...a)=>calls.push(a)}),true);
 assert.deepEqual(calls,[['target','link','file']]);assert.deepEqual(skips,[]);
});
for(const code of ['EPERM','EACCES'])test(`symlink fixture policy marks Windows ${code} BLOCKED instead of passing`,()=>{
 const error=Object.assign(new Error('fixture permission denied'),{code}),skips=[];
 assert.equal(createSymlinkFixture({skip:r=>skips.push(r)},'target','link','dir',{platform:'win32',strict:false,create:()=>{throw error;}}),false);
 assert.equal(skips.length,1);assert.match(skips[0],new RegExp(`BLOCKED.*${code}`));
});
test('strict qualification never turns missing link privilege into a skip',()=>{
 const error=Object.assign(new Error('denied'),{code:'EPERM'});
 assert.throws(()=>createSymlinkFixture({skip:()=>assert.fail('strict skip')},'t','l','file',{
  platform:'win32',strict:true,create:()=>{throw error;}}),e=>e===error);
 const calls=[];createSymlinkFixture({skip:()=>assert.fail('skip')},'t','l','dir',{platform:'win32',create:(...a)=>calls.push(a)});
 assert.deepEqual(calls,[['t','l','junction']]);
});
test('symlink fixture policy does not hide Linux permission failures',()=>{
 for(const code of ['EPERM','EACCES']){
  const error=Object.assign(new Error('denied'),{code});
  assert.throws(()=>createSymlinkFixture({skip:()=>assert.fail('unexpected skip')},'t','l','file',{platform:'linux',create:()=>{throw error;}}),e=>e===error);
 }
});
test('symlink fixture policy does not hide unexpected Windows failures',()=>{
 for(const error of [Object.assign(new Error('missing'),{code:'ENOENT'}),Object.assign(new Error('exists'),{code:'EEXIST'}),Object.assign(new Error('io'),{code:'EIO'}),new Error('unknown'),null]){
  assert.throws(()=>createSymlinkFixture({skip:()=>assert.fail('unexpected skip')},'t','l','file',{platform:'win32',create:()=>{throw error;}}),e=>e===error);
 }
});
