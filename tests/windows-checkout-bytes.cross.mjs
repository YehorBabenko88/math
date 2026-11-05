import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,unlinkSync,rmSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareExactCheckout} from '../scripts/prepare-exact-checkout.mjs';
import {verifySourceIdentity} from '../scripts/verify-source-identity.mjs';

function fixture(run){
 const root=mkdtempSync(join(tmpdir(),'math-checkout-bytes-'));
 const git=(...args)=>execFileSync('git',['-C',root,...args],{stdio:['ignore','pipe','pipe']});
 try{
  git('init','-q');git('config','core.autocrlf','false');
  for(const [name,raw] of Object.entries({'.gitattributes':'raw.bin -text\n','a.mjs':'export const value=1;\n','z.yml':'name: synthetic\non: workflow_dispatch\n','raw.bin':Buffer.from([0,13,10,255])}))writeFileSync(join(root,name),raw);
  git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');
  const head=git('rev-parse','HEAD').toString().trim();
  git('config','core.autocrlf','true');
  for(const name of ['.gitattributes','a.mjs','z.yml','raw.bin'])unlinkSync(join(root,name));
  git('checkout-index','--all','--force','--index');
  assert.match(readFileSync(join(root,'a.mjs'),'utf8'),/\r\n/);
  run({root,git,head});
 }finally{rmSync(root,{recursive:true,force:true});}
}

test('exact checkout preparation restores real Git CRLF checkout and retains exact index',()=>fixture(({root,git,head})=>{
 const result=prepareExactCheckout({root,expectedHead:head});
 assert.equal(result.files,4);assert.ok(result.rewritten>=2);
 for(const name of ['.gitattributes','a.mjs','z.yml','raw.bin'])assert.deepEqual(readFileSync(join(root,name)),git('show','HEAD:'+name));
 assert.equal(git('diff-index','--cached','--name-only','HEAD').length,0);
 assert.equal(prepareExactCheckout({root,expectedHead:head}).rewritten,0);
 const previous=process.cwd();
 try{process.chdir(root);assert.equal(verifySourceIdentity(head).sourceSha,head);}finally{process.chdir(previous);}
 const child=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/prepare-exact-checkout.mjs',import.meta.url)),'--expected-head',head],{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:4096,windowsHide:true});
 assert.equal(child.status,0);assert.equal(child.stderr,'');assert.equal(JSON.parse(child.stdout).rewritten,0);
}));

test('exact checkout preparation rejects actual edits before rewriting any file',()=>fixture(({root,head})=>{
 const before=readFileSync(join(root,'a.mjs'));
 writeFileSync(join(root,'z.yml'),'name: actual edit\r\n');
 assert.throws(()=>prepareExactCheckout({root,expectedHead:head}),/CHECKOUT_PREPARATION_REJECTED/);
 assert.deepEqual(readFileSync(join(root,'a.mjs')),before);
}));

test('exact checkout preparation rejects wrong HEAD staged changes and hardlinks',()=>fixture(({root,git,head})=>{
 assert.throws(()=>prepareExactCheckout({root,expectedHead:'0'.repeat(40)}),/CHECKOUT_PREPARATION_REJECTED/);
 writeFileSync(join(root,'z.yml'),'name: staged edit\n');git('add','z.yml');
 assert.throws(()=>prepareExactCheckout({root,expectedHead:head}),/CHECKOUT_PREPARATION_REJECTED/);
 git('reset','--mixed','HEAD');writeFileSync(join(root,'z.yml'),git('show','HEAD:z.yml'));
 linkSync(join(root,'a.mjs'),join(root,'untracked-hardlink'));
 assert.throws(()=>prepareExactCheckout({root,expectedHead:head}),/CHECKOUT_PREPARATION_REJECTED/);
}));
