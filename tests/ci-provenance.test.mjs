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
import {captureSourceIdentity} from '../scripts/verify-source-identity.mjs';
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
  assert.throws(()=>createProvenance(env),/dependency|manifest|lock|package/i,'root-only committed lock must not qualify');
  const project=new URL('../',import.meta.url);
  for(const name of ['package.json','package-lock.json','scripts/book-ingestion-requirements.txt']){
   const {mkdir}=await import('node:fs/promises');await mkdir(join(directory,'scripts'),{recursive:true});await writeFile(name,await readFile(new URL(name,project)));
  }
  git('-c','core.autocrlf=false','add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','valid dependencies');env.GITHUB_SHA=git('rev-parse','HEAD');
  env.SOURCE_IDENTITY_RECEIPT=join(tmpdir(),'math-before-'+env.GITHUB_SHA+'-'+Date.now()+'.json');captureSourceIdentity(env);
  const good=createProvenance(env);assert.equal(good.qualified,true);assert.equal(good.dependencyPolicy,'math-dependency-contract/v1');assert.match(good.pythonRequirementsSha256,/^[a-f0-9]{64}$/);
  const original=await readFile('package.json','utf8');await writeFile('package.json',original.replace('8.16.3','8.16.2'));assert.throws(()=>createProvenance(env),/manifest/i);await writeFile('package.json',original);
  const python=await readFile('scripts/book-ingestion-requirements.txt','utf8');await writeFile('scripts/book-ingestion-requirements.txt',python.replace('6.20.1','6.20.2'));assert.throws(()=>createProvenance(env),/Python/);await writeFile('scripts/book-ingestion-requirements.txt',python);
  const validLock=await readFile('package-lock.json','utf8');await writeFile('package-lock.json',validLock.replaceAll('\n','\r\n'));assert.throws(()=>createProvenance(env),/Lock bytes differ/);

 }finally{process.chdir(previous);await rm(directory,{recursive:true,force:true});}
});

test('each producer checks tracked source before and after tests; Pester is prepared before candidate JS',async()=>{
 for(const name of ['ci.yml','book-ingestion.yml','browser.yml','postgres-integration.yml','windows-deployment.yml']){
  const workflow=await readFile('.github/workflows/'+name,'utf8');
  assert.match(workflow,/SOURCE_IDENTITY_RECEIPT: \$\{\{ runner.temp \}\}\/math-source-before.json/);
  assert.ok(workflow.indexOf('node scripts/verify-source-identity.mjs --before')<workflow.indexOf('node scripts/ci-provenance.mjs'));
 }
 const windows=await readFile('.github/workflows/windows-deployment.yml','utf8');
 assert.ok(windows.indexOf('Prepare pinned fixture framework')<windows.indexOf('node scripts/verify-source-identity.mjs'));
 assert.ok(windows.indexOf('-VerifyOnly')<windows.indexOf('Import-Module'));
 assert.match(windows,/tests\/sql-byte-integrity.test.mjs/);
});
