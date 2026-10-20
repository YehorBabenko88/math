import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
test('external workflow actions are immutable and Pester download is verified',async()=>{
 for(const name of await readdir('.github/workflows')){
  const text=await readFile('.github/workflows/'+name,'utf8');
  for(const match of text.matchAll(/uses:\s*([^\s]+)@([^\s]+)/g)) assert.match(match[2],/^[a-f0-9]{40}$/);
 }
 const windows=await readFile('.github/workflows/windows-deployment.yml','utf8');
 assert.doesNotMatch(windows,/Save-Module/);assert.match(windows,/install-pester-verified.ps1/);
});

import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createProvenance,sha256} from '../scripts/ci-provenance.mjs';
test('provenance is unqualified without a committed lock and rejects wrong source or lock bytes',async()=>{
 const previous=process.cwd(),directory=await mkdtemp(join(tmpdir(),'math-provenance-'));
 const git=(...args)=>execFileSync('git',['-C',directory,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git('init','--quiet');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','--allow-empty','-m','initial');
  process.chdir(directory);
  const env={GITHUB_SHA:git('rev-parse','HEAD'),GITHUB_REPOSITORY:'YehorBabenko88/math',GITHUB_WORKFLOW_REF:'YehorBabenko88/math/.github/workflows/ci.yml@refs/heads/example',GITHUB_RUN_ID:'7',GITHUB_RUN_ATTEMPT:'2',PROVENANCE_CONTEXT:'test'};
  assert.equal(createProvenance(env).qualified,false);assert.equal(createProvenance(env).lockSha256,null);
  await writeFile('package-lock.json','uncommitted lock');assert.equal(createProvenance(env).qualified,false);
  assert.throws(()=>createProvenance({...env,GITHUB_SHA:'0'.repeat(40)}),/source SHA/);
  const lock='{"lockfileVersion":3}\n';await writeFile('package-lock.json',lock);git('-c','core.autocrlf=false','add','package-lock.json');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','lock');env.GITHUB_SHA=git('rev-parse','HEAD');
  const actual=createProvenance(env);assert.equal(actual.qualified,true);assert.equal(actual.lockSha256,sha256(lock));assert.equal(actual.runAttempt,'2');assert.equal(actual.workflowPath,'.github/workflows/ci.yml');
  await writeFile('package-lock.json',lock.replaceAll('\n','\r\n'));assert.throws(()=>createProvenance(env),/Lock bytes differ/);
 }finally{process.chdir(previous);await rm(directory,{recursive:true,force:true});}
});
