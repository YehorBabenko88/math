import {readFileSync,writeFileSync,lstatSync,realpathSync,openSync,readSync,closeSync,fstatSync,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

function fail(message){throw Error('QA evidence rejected: '+message);}
export function buildManifest({root,files,sourceSha,runId,runAttempt,jobId}){
 if(!/^[a-f0-9]{40}$/.test(sourceSha))fail('invalid source SHA');
 if(!Number.isSafeInteger(runId)||runId<=0||!Number.isSafeInteger(runAttempt)||runAttempt<=0)fail('invalid run identity');
 if(typeof jobId!=='string'||!jobId.trim())fail('missing job identity');
 if(!Array.isArray(files)||files.length===0||new Set(files).size!==files.length)fail('missing or duplicate files');
 const rootPath=resolve(root);
 if(realpathSync(rootPath)!==rootPath)fail('symlinked evidence root');
 const entries=files.map(name=>{
  if(typeof name!=='string'||!name||isAbsolute(name)||name.split(/[\\/]/).includes('..'))fail('unsafe path');
  if(name==='.'||name.split(/[\\/]/).includes('.')||name.includes(String.fromCharCode(92)))fail('ambiguous evidence path');
  const path=resolve(rootPath,name),rel=relative(rootPath,path);
  if(!rel||rel.startsWith('..'+sep)||rel==='..'||isAbsolute(rel))fail('outside root');
  for(let parent=dirname(path);parent!==rootPath;parent=dirname(parent)){
   if(!parent.startsWith(rootPath+sep))fail('outside root');
   if(lstatSync(parent).isSymbolicLink())fail('symlinked evidence parent');
  }
  const stat=lstatSync(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)fail('unsafe evidence file');
  if(realpathSync(path)!==path)fail('symlinked evidence parent');
  if(stat.size>64*1024*1024)fail('evidence file too large');
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  let bytes;
  try{
   const opened=fstatSync(fd);
   if(!opened.isFile()||opened.nlink!==1||opened.dev!==stat.dev||opened.ino!==stat.ino)fail('evidence replaced before open');
   if(opened.size>64*1024*1024)fail('evidence file too large');
   bytes=Buffer.alloc(opened.size);
   let offset=0;
   while(offset<bytes.length){const count=readSync(fd,bytes,offset,bytes.length-offset,offset);if(count===0)fail('truncated evidence');offset+=count;}
   const after=fstatSync(fd);
   if(after.dev!==opened.dev||after.ino!==opened.ino||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||after.nlink!==1)fail('evidence changed during read');
  }finally{closeSync(fd);}
  const current=lstatSync(path);
  if(current.dev!==stat.dev||current.ino!==stat.ino||current.nlink!==1)fail('evidence path replaced');
  return {path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 });
 return {schemaVersion:1,sourceSha,runId,runAttempt,jobId,entries};
}
export function verifyManifest(manifest,root,expectedContext){
 if(!manifest||manifest.schemaVersion!==1||Array.isArray(manifest)||Object.getPrototypeOf(manifest)!==Object.prototype)fail('invalid schema');
 if(!expectedContext||typeof expectedContext!=='object')fail('trusted run context required');
 if(Object.keys(manifest).sort().join(',')!==['schemaVersion','sourceSha','runId','runAttempt','jobId','entries'].sort().join(','))fail('unexpected manifest fields');
 if(!Array.isArray(manifest.entries)||manifest.entries.some(e=>!e||Object.keys(e).sort().join(',')!==['path','bytes','sha256'].sort().join(',')))fail('invalid evidence entries');
 const expected=buildManifest({root,files:manifest.entries?.map(e=>e.path),sourceSha:manifest.sourceSha,runId:manifest.runId,runAttempt:manifest.runAttempt,jobId:manifest.jobId});
 if(JSON.stringify(expected)!==JSON.stringify(manifest))fail('digest, size or metadata mismatch');
 for(const key of ['sourceSha','runId','runAttempt','jobId'])if(manifest[key]!==expectedContext[key])fail('untrusted run context');
 return true;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [mode,root,manifestPath,...files]=process.argv.slice(2);
  if(mode==='create'){
   const m=buildManifest({root,files,sourceSha:process.env.GITHUB_SHA,runId:Number(process.env.GITHUB_RUN_ID),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),jobId:process.env.QA_JOB_ID});
   writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');
  }else if(mode==='verify'){verifyManifest(JSON.parse(readFileSync(manifestPath,'utf8')),root,{sourceSha:process.env.GITHUB_SHA,runId:Number(process.env.GITHUB_RUN_ID),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),jobId:process.env.QA_JOB_ID});}
  else fail('usage: create|verify ROOT MANIFEST [FILES...]');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
