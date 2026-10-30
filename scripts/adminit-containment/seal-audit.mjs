import {seal} from '../../src/evidence-receiver/seal.mjs';
import {createPublicKey} from 'node:crypto';
import {readFileSync,writeFileSync,lstatSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export function sealAuditEvidence(payload,key){return seal(payload,key);}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_ENVIRONMENT!=='github-hosted'||process.platform!=='win32')throw Error();
  const [build,run,output]=process.argv.slice(2);if(!build||!run||!output)throw Error();
  const payload={sourceHead:process.env.GITHUB_SHA,sourceTree:process.env.SOURCE_TREE,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,files:{}};
  for(const [name,path] of [['bootstrap-stdout.txt',resolve(build,'bootstrap-stdout.txt')],['bootstrap-stderr.txt',resolve(build,'bootstrap-stderr.txt')],['bootstrap-process.json',resolve(build,'bootstrap-process.json')],['results.json',resolve(run,'results.json')]]){
   for(let p=dirname(path);;p=dirname(p)){const s=lstatSync(p,{throwIfNoEntry:false});if(s&&(!s.isDirectory()||s.isSymbolicLink()))throw Error();if(dirname(p)===p)break;}
   const s=lstatSync(path,{throwIfNoEntry:false});if(!s){payload.files[name]=null;continue;}
   if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>1048576)throw Error();
   payload.files[name]=readFileSync(path).toString('base64');
  }
  const bytes=sealAuditEvidence(payload,createPublicKey(readFileSync(new URL('./audit-recipient.pem',import.meta.url))));
  writeFileSync(output,bytes,{flag:'wx'});
 }catch{console.error('Private native audit sealing BLOCKED; payload suppressed');process.exitCode=2;}
}
