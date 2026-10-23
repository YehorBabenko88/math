import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,symlink,chmod,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FileReplayLedger} from '../src/knowledge/file-replay-ledger.mjs';
test('ledger rejects symlink directory',async t=>{
 const root=await mkdtemp(join(tmpdir(),'kg-dirguard-'));
 try {
  await mkdir(join(root,'real'),{mode:0o700});
  try {await symlink(join(root,'real'),join(root,'link'),'dir');}
  catch(e) {if(['EPERM','EACCES','ENOTSUP'].includes(e.code)){t.skip('symlink privilege unavailable');return;}throw e;}
  await assert.rejects(new FileReplayLedger(join(root,'link')).consume('a'.repeat(64)),/unsafe ledger directory/);
 } finally {await rm(root,{recursive:true,force:true});}
});
test('ledger rejects group-writable directory on POSIX',async t=>{
 if(process.platform==='win32'){t.skip('POSIX mode semantics');return;}
 const root=await mkdtemp(join(tmpdir(),'kg-dirguard-'));
 try {
  const dir=join(root,'ledger');await mkdir(dir);await chmod(dir,0o777);
  await assert.rejects(new FileReplayLedger(dir).consume('b'.repeat(64)),/accessible to others/);
 } finally {await rm(root,{recursive:true,force:true});}
});

test('ledger rejects a non-directory path',async()=>{
 const root=await mkdtemp(join(tmpdir(),'kg-dirguard-'));
 try {
  const {writeFile}=await import('node:fs/promises');
  const path=join(root,'file');await writeFile(path,'not a directory');
  await assert.rejects(new FileReplayLedger(path).consume('c'.repeat(64)));
 } finally {await rm(root,{recursive:true,force:true});}
});

test('ledger rejects a symlinked ancestor even when leaf is a directory',async t=>{
 const root=await mkdtemp(join(tmpdir(),'kg-ancestor-'));
 try {
  const real=join(root,'real'),alias=join(root,'alias');
  await mkdir(join(real,'ledger'),{recursive:true,mode:0o700});
  try {await symlink(real,alias,'dir');}
  catch(error) {if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.skip('symlink privilege unavailable');return;}throw error;}
  await assert.rejects(new FileReplayLedger(join(alias,'ledger')).consume('d'.repeat(64)),/unsafe ledger ancestor/);
 } finally {await rm(root,{recursive:true,force:true});}
});
