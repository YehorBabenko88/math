import{readFileSync,lstatSync,readdirSync,realpathSync}from'node:fs';import{resolve,dirname,join,isAbsolute}from'node:path';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
function check(ok,message){if(!ok)throw Error('ADMINIT package BLOCKED: '+message);}
function noLinks(path){for(let p=resolve(path);;){const s=lstatSync(p);check(!s.isSymbolicLink(),'reparse path');if(s.isFile())check(s.nlink===1,'hardlink');else check(s.isDirectory(),'special file');const parent=dirname(p);if(parent===p)return;p=parent;}}
export function verifyAdminitPackage({directory,expectedManifestSha256,expectedSourceHead}={}){
 check(typeof directory==='string'&&isAbsolute(directory)&&!directory.split(/[\\/]/).some(x=>x==='.'||x==='..')&&!directory.startsWith('\\\\'),'literal absolute package directory');check(typeof expectedManifestSha256==='string'&&/^[a-f0-9]{64}$/.test(expectedManifestSha256),'out-of-band manifest digest');check(typeof expectedSourceHead==='string'&&/^[a-f0-9]{40}$/.test(expectedSourceHead),'expected source');
 noLinks(directory);const root=resolve(directory),canonical=realpathSync(root);check(process.platform==='win32'?canonical.toLowerCase()===root.toLowerCase():canonical===root,'canonical package path');
 check(JSON.stringify(readdirSync(root).sort())===JSON.stringify(['AdminitSyntheticHarness.exe','package.json']),'exact inventory');
 const path=join(root,'package.json');noLinks(path);check(lstatSync(path).size<=16384,'manifest size');const bytes=readFileSync(path);check(sha(bytes)===expectedManifestSha256,'manifest digest');const m=JSON.parse(bytes.toString('utf8'));
 check(m&&Object.getPrototypeOf(m)===Object.prototype&&Object.keys(m).sort().join(',')==='files,localExecution,schema,sourceHead,sourceTree','manifest fields');
 check(m.schema===1&&m.sourceHead===expectedSourceHead&&typeof m.sourceTree==='string'&&/^[a-f0-9]{40}$/.test(m.sourceTree)&&m.localExecution==='BLOCKED_PENDING_ISOLATION_REVIEW','source or local execution policy');
 check(Array.isArray(m.files)&&m.files.length===1,'file inventory');const f=m.files[0];check(f&&Object.keys(f).sort().join(',')==='bytes,path,sha256'&&f.path==='AdminitSyntheticHarness.exe'&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&f.bytes<=16777216&&/^[a-f0-9]{64}$/.test(f.sha256),'executable metadata');
 const exe=join(root,f.path);noLinks(exe);check(lstatSync(exe).size===f.bytes,'executable size');check(sha(readFileSync(exe))===f.sha256,'executable digest');noLinks(exe);noLinks(path);
 return Object.freeze({sourceHead:m.sourceHead,sourceTree:m.sourceTree,manifestSha256:expectedManifestSha256,executableSha256:f.sha256,localExecution:m.localExecution,evidence:'point-in-time file identity only, not isolation or independent attestation'});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{check(process.argv.length===5,'usage: DIRECTORY EXPECTED_MANIFEST_SHA256 EXPECTED_SOURCE_HEAD');console.log(JSON.stringify(verifyAdminitPackage({directory:process.argv[2],expectedManifestSha256:process.argv[3],expectedSourceHead:process.argv[4]})));}catch(e){console.error(e.message);process.exitCode=2;}
}
