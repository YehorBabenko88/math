import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function validatePythonLocks(text){
 const entries=text.replace(/\\\r?\n/g,' ').split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#'));
 const expected=['pypdf==6.20.1','pypdfium2==5.14.0','pillow==12.3.0'];
 if(entries.length!==expected.length)throw Error('Unapproved Python dependency graph');
 for(const [index,line] of entries.entries()){const tokens=line.trim().split(/\s+/);if(tokens.shift()!==expected[index]||!tokens.length||tokens.some(token=>!/^--hash=sha256:[a-f0-9]{64}$/.test(token)))throw Error('Python artifact hash lock required');}
}
const approved={'@playwright/test':'1.56.1',pg:'8.16.3'};
export function validateDependencyLocks(manifest,lock){
 if(!lock||lock.lockfileVersion!==3||!lock.packages?.[''])throw Error('Committed npm v3 lock required');
 if(['dependencies','optionalDependencies','peerDependencies'].some(field=>Object.keys(manifest[field]??{}).length)||JSON.stringify(Object.entries(manifest.devDependencies??{}).sort())!==JSON.stringify(Object.entries(approved).sort()))throw Error('Unapproved dependency manifest drift');
 for(const field of ['dependencies','devDependencies','optionalDependencies'])if(JSON.stringify(manifest[field]??{})!==JSON.stringify(lock.packages[''][field]??{}))throw Error('Manifest and lock drift');
 for(const [path,pkg] of Object.entries(lock.packages)){
  if(!path)continue;
  if(!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pkg.version??'')||!/^sha512-[A-Za-z0-9+/]+=*$/.test(pkg.integrity??'')||!pkg.resolved?.startsWith('https://registry.npmjs.org/')||pkg.link)throw Error('Unverified dependency artifact: '+path);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{validateDependencyLocks(JSON.parse(await readFile('package.json')),JSON.parse(await readFile('package-lock.json')));validatePythonLocks(await readFile('scripts/book-ingestion-requirements.txt','utf8'));console.log('Dependency lock verified');}catch(error){console.error(error.message);process.exitCode=1;}
}
