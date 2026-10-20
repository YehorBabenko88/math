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
