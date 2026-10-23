import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const pythonArtifacts=[['aa5a55ddcffdc5e5ab291d5decb23f6383f4e56f8e3263dc39af41fff03885ad'], ['11f281613fa22313d9c7ab89947665e84eccf8ebe40e1198a84a88352305648d', '149fd5c6397b8df8bf7911a93506eff0be874f877afe7ac936cf5d37d21a6a06'], ['78cb2c6865a35ab8ff8b75fd122f6033b92a62c82801110e48ddd6c936a45d91', 'a2b55dd6b2a4c4b7d87ffa56bdb33fdc5fdb9a462173861a7bc097f17d91cb09']];
export function validatePythonLocks(text){
 const entries=text.replace(/\\\r?\n/g,' ').split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#'));
 const expected=['pypdf==6.20.1','pypdfium2==5.14.0','pillow==12.3.0'];
 if(entries.length!==expected.length)throw Error('Unapproved Python dependency graph');
 for(const [index,line] of entries.entries()){const tokens=line.trim().split(/\s+/);if(tokens.shift()!==expected[index]||!tokens.length||tokens.some(token=>!/^--hash=sha256:[a-f0-9]{64}$/.test(token)))throw Error('Python artifact hash lock required');if(JSON.stringify(tokens.map(t=>t.slice(14)).sort())!==JSON.stringify([...pythonArtifacts[index]].sort()))throw Error('Unapproved Python artifact hashes');}
}
const approved={'@playwright/test':'1.56.1',pg:'8.16.3'};
// Reviewed semantic graph allowlist. Changes require explicit policy review;
// npm ci never changes this graph. Canonicalization affects validation only,
// never SQL bytes or any persisted migration history.
function canonical(value){return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;}
// Manifest is an installation input too. New keys (including future npm
// directives) and lifecycle scripts require review before this contract allows them.
const approvedManifestKeys=['name','version','private','type','scripts','devDependencies'];
const approvedScripts={test:'node --test tests/*.test.mjs','test:e2e':'playwright test'};
const approvedNpmGraphSha256='f7b50c61fc2982c88e38b79e6510a7980d09f5bdf55044a95dcdb1cdcf711389';
export function validateDependencyLocks(manifest,lock){
 if(!manifest||Array.isArray(manifest)||typeof manifest!=='object'||Object.keys(manifest).some(key=>!approvedManifestKeys.includes(key))||manifest.private!==true||manifest.type!=='module'||JSON.stringify(canonical(manifest.scripts))!==JSON.stringify(canonical(approvedScripts)))throw Error('Unapproved installation manifest directives');
 if(!lock||lock.lockfileVersion!==3||!lock.packages?.[''])throw Error('Committed npm v3 lock required');
 if(['dependencies','optionalDependencies','peerDependencies'].some(field=>Object.keys(manifest[field]??{}).length)||JSON.stringify(Object.entries(manifest.devDependencies??{}).sort())!==JSON.stringify(Object.entries(approved).sort()))throw Error('Unapproved dependency manifest drift');
 for(const field of ['dependencies','devDependencies','optionalDependencies'])if(JSON.stringify(manifest[field]??{})!==JSON.stringify(lock.packages[''][field]??{}))throw Error('Manifest and lock drift');
 if(lock.name!==manifest.name||lock.version!==manifest.version||lock.packages[''].name!==manifest.name||lock.packages[''].version!==manifest.version)throw Error('Manifest identity drift');
 for(const [name,version] of Object.entries(approved))if(lock.packages['node_modules/'+name]?.version!==version)throw Error('Missing or inconsistent locked dependency: '+name);
 for(const [path,pkg] of Object.entries(lock.packages)){
  if(!path)continue;
  if(!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pkg.version??'')||!/^sha512-[A-Za-z0-9+/]+=*$/.test(pkg.integrity??'')||!pkg.resolved?.startsWith('https://registry.npmjs.org/')||pkg.link)throw Error('Unverified dependency artifact: '+path);
 }
 if(createHash('sha256').update(JSON.stringify(canonical(lock.packages))).digest('hex')!==approvedNpmGraphSha256)throw Error('Unapproved npm graph');
}
export const dependencyPolicy='math-dependency-contract/v1';
export function verifyCommittedDependencies({repository='.',sourceSha}={}){
 if(!/^[a-f0-9]{40}$/.test(sourceSha??''))throw Error('Invalid dependency source SHA');
 const blob=path=>execFileSync('git',['--no-replace-objects','-C',repository,'show',sourceSha+':'+path],{stdio:['ignore','pipe','pipe']});
 const manifest=blob('package.json'),lock=blob('package-lock.json'),python=blob('scripts/book-ingestion-requirements.txt');
 validateDependencyLocks(JSON.parse(manifest),JSON.parse(lock));validatePythonLocks(python.toString('utf8'));
 const digest=b=>createHash('sha256').update(b).digest('hex');
 return {sourceSha,dependencyPolicy,lockSha256:digest(lock),packageManifestSha256:digest(manifest),pythonRequirementsSha256:digest(python)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{if(process.argv[2]==='--git-source'){if(process.argv.length!==5)throw Error('Repository and exact SHA required');console.log(JSON.stringify(verifyCommittedDependencies({repository:process.argv[3],sourceSha:process.argv[4]})));}else{validateDependencyLocks(JSON.parse(await readFile('package.json')),JSON.parse(await readFile('package-lock.json')));validatePythonLocks(await readFile('scripts/book-ingestion-requirements.txt','utf8'));console.log('Dependency lock verified');}}catch(error){console.error(error.message);process.exitCode=1;}
}
