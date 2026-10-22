import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute} from 'node:path';

function fail(message){throw Error('QA evidence rejected: '+message);}
export function buildManifest({root,files,sourceSha,runId,runAttempt,jobId}){
 if(!/^[a-f0-9]{40}$/.test(sourceSha))fail('invalid source SHA');
 if(!Number.isSafeInteger(runId)||runId<=0||!Number.isSafeInteger(runAttempt)||runAttempt<=0)fail('invalid run identity');
 if(typeof jobId!=='string'||!jobId.trim())fail('missing job identity');
 if(!Array.isArray(files)||files.length===0||new Set(files).size!==files.length)fail('missing or duplicate files');
 const entries=files.map(name=>{
  if(typeof name!=='string'||!name||isAbsolute(name)||name.split(/[\\/]/).includes('..'))fail('unsafe path');
  const path=resolve(root,name),rel=relative(resolve(root),path);
  if(rel.startsWith('..')||isAbsolute(rel))fail('outside root');
  const bytes=readFileSync(path);
  return {path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 });
 return {schemaVersion:1,sourceSha,runId,runAttempt,jobId,entries};
}
export function verifyManifest(manifest,root){
 if(!manifest||manifest.schemaVersion!==1)fail('invalid schema');
 const expected=buildManifest({root,files:manifest.entries?.map(e=>e.path),sourceSha:manifest.sourceSha,runId:manifest.runId,runAttempt:manifest.runAttempt,jobId:manifest.jobId});
 if(JSON.stringify(expected)!==JSON.stringify(manifest))fail('digest, size or metadata mismatch');
 return true;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 try{
  const [mode,root,manifestPath,...files]=process.argv.slice(2);
  if(mode==='create'){
   const m=buildManifest({root,files,sourceSha:process.env.GITHUB_SHA,runId:Number(process.env.GITHUB_RUN_ID),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),jobId:process.env.QA_JOB_ID});
   writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');
  }else if(mode==='verify'){verifyManifest(JSON.parse(readFileSync(manifestPath,'utf8')),root);}
  else fail('usage: create|verify ROOT MANIFEST [FILES...]');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
