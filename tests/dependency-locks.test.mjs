import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateDependencyLocks,validatePythonLocks} from '../scripts/verify-dependency-locks.mjs';
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url)));
test('committed dependency graph is approved and artifact verified',()=>validateDependencyLocks(manifest,lock));
test('missing lock fails closed',()=>assert.throws(()=>validateDependencyLocks(manifest,null),/lock/));
test('manifest drift and unapproved dependencies fail closed',()=>{
 for(const changed of [{...manifest,devDependencies:{...manifest.devDependencies,pg:'8.16.2'}},{...manifest,dependencies:{surprise:'1.0.0'}},{...manifest,optionalDependencies:{surprise:'1.0.0'}},{...manifest,peerDependencies:{surprise:'1.0.0'}}])assert.throws(()=>validateDependencyLocks(changed,lock));
});
test('missing integrity and non-registry artifacts fail closed',()=>{
 for(const field of ['integrity','resolved']){const changed=structuredClone(lock);delete changed.packages['node_modules/pg'][field];assert.throws(()=>validateDependencyLocks(manifest,changed));}
 const changed=structuredClone(lock);changed.packages['node_modules/pg'].resolved='https://example.com/pg.tgz';assert.throws(()=>validateDependencyLocks(manifest,changed));
});
test('every mandatory npm installation uses ci',async()=>{
 for(const name of ['browser.yml','postgres-integration.yml']){const text=await readFile(new URL('../.github/workflows/'+name,import.meta.url),'utf8');assert.match(text,/npm ci --ignore-scripts --no-audit --no-fund/);assert.doesNotMatch(text,/npm install/);}
});

test('Python closure requires approved exact versions and artifact hashes',async()=>{
 const text=await readFile(new URL('../scripts/book-ingestion-requirements.txt',import.meta.url),'utf8');validatePythonLocks(text);
 for(const invalid of [text.replace(/--hash=sha256:[a-f0-9]{64}/g,''),text.replace('6.20.1','6.20.2'),text+'surprise==1.0.0 --hash=sha256:'+'a'.repeat(64)])assert.throws(()=>validatePythonLocks(invalid));
 for(const name of ['book-ingestion.yml','postgres-integration.yml'])assert.match(await readFile(new URL('../.github/workflows/'+name,import.meta.url),'utf8'),/--require-hashes --only-binary=:all:/);
});

test('qualified dependency contracts reject incomplete graph and unapproved Python hashes',async()=>{
 const changed=structuredClone(lock);delete changed.packages['node_modules/pg'];assert.throws(()=>validateDependencyLocks(manifest,changed),/locked dependency/);
 const text=await readFile(new URL('../scripts/book-ingestion-requirements.txt',import.meta.url),'utf8');
 assert.throws(()=>validatePythonLocks(text.replace(/sha256:[a-f0-9]{64}/,'sha256:'+'0'.repeat(64))),/Unapproved Python/);
});

test('unreviewed transitive graph cannot qualify even with well formed registry metadata',()=>{
 const changed=structuredClone(lock);changed.packages['node_modules/surprise']={version:'1.0.0',resolved:'https://registry.npmjs.org/surprise/-/surprise-1.0.0.tgz',integrity:lock.packages['node_modules/pg'].integrity};
 assert.throws(()=>validateDependencyLocks(manifest,changed),/Unapproved npm graph/);
});

test('unapproved installation directives fail closed without changing the approved lock',()=>{
 for(const directive of [
  {overrides:{pg:'8.16.2'}},{overrides:{pg:'$pg'}},
  {workspaces:['packages/*']},{config:{'unsafe-perm':true}},
  {engines:{node:'>=999'}},{os:['!win32']},{cpu:['!x64']},
  {bundleDependencies:['pg']},{bundledDependencies:['pg']},
  {peerDependenciesMeta:{pg:{optional:true}}},{devEngines:{runtime:{name:'node',version:'>=999'}}},
  {packageManager:'npm@0.0.0'},{publishConfig:{registry:'https://example.invalid'}},
  {futureInstallDirective:true},
 ])assert.throws(()=>validateDependencyLocks({...manifest,...directive},lock),/Unapproved.*manifest/,JSON.stringify(directive));
 for(const scripts of [{...manifest.scripts,preinstall:'node unwanted.mjs'},{test:'node unwanted.mjs','test:e2e':'playwright test'}])assert.throws(()=>validateDependencyLocks({...manifest,scripts},lock),/Unapproved.*manifest/);
});

test('approved manifest scripts remain usable and npm ci agrees with the direct-override rejection',async()=>{
 const {mkdtemp,writeFile,rm,realpath,access}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join,dirname,delimiter,basename}=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 // A standalone Node runtime need not ship npm. Resolve the installed npm CLI
 // from PATH without a shell, then run it with the runtime under test.
 const npmCandidates=[process.env.npm_execpath,join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js')];
 for(const directory of (process.env.PATH??'').split(delimiter).filter(Boolean)){
  npmCandidates.push(join(directory,'node_modules/npm/bin/npm-cli.js'));
  if(process.platform!=='win32'){
   try{npmCandidates.push(await realpath(join(directory,'npm')));}catch{}
  }
 }
 let npmCli;
 for(const candidate of npmCandidates){
  if(!candidate||basename(candidate)!=='npm-cli.js')continue;
  try{await access(candidate);npmCli=candidate;break;}catch{}
 }
 assert.ok(npmCli,'npm CLI must be installed and discoverable via npm_execpath or PATH');
 const fixture=await mkdtemp(join(tmpdir(),'math-npm-contract-'));
 try{
  await writeFile(join(fixture,'package-lock.json'),JSON.stringify(lock));
  const run=async(value)=>{
   await writeFile(join(fixture,'package.json'),JSON.stringify(value));
   const result=spawnSync(process.execPath,[npmCli,'ci','--dry-run','--ignore-scripts','--no-audit','--no-fund','--offline'],{cwd:fixture,encoding:'utf8',windowsHide:true,timeout:30000});
   assert.ifError(result.error);return result;
  };
  const clean=await run(manifest);assert.equal(clean.status,0,clean.stderr);
  const changed={...manifest,overrides:{pg:'8.16.2'}};
  const invalid=await run(changed);assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/EUSAGE|EOVERRIDE|Invalid/);
  validateDependencyLocks(manifest,lock);
  assert.throws(()=>validateDependencyLocks(changed,lock),/Unapproved.*manifest/);
 }finally{await rm(fixture,{recursive:true,force:true});}
});
