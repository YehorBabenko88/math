import {readFileSync,writeFileSync,lstatSync} from 'node:fs';
import {createPublicKey} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {seal} from '../../src/evidence-receiver/seal.mjs';
try{
 if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_ENVIRONMENT!=='github-hosted')throw Error();
 const root=resolve(process.env.RUNNER_TEMP,'loader-diagnostic');
 for(let p=root;;p=dirname(p)){const s=lstatSync(p);if(!s.isDirectory()||s.isSymbolicLink())throw Error();if(dirname(p)===p)break;}
 const files={};
 for(const name of ['trace.json','bootstrap-stdout.txt','bootstrap-stderr.txt','controller-stdout.txt','controller-stderr.txt','application-events.json']){
  const path=resolve(root,name),s=lstatSync(path,{throwIfNoEntry:false});
  if(!s){files[name]=null;continue;}
  if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>8388608)throw Error();
  files[name]=readFileSync(path).toString('base64');
 }
 const payload={scope:'DIAGNOSTIC_ONLY_NOT_NATIVE_ACCEPTANCE',kitHead:process.env.GITHUB_SHA,sourceHead:process.env.SOURCE_HEAD,sourceTree:process.env.SOURCE_TREE,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,files};
 writeFileSync(resolve(process.env.RUNNER_TEMP,'loader-trace.sealed.json'),seal(payload,createPublicKey(readFileSync(new URL('./audit-recipient.pem',import.meta.url)))),{flag:'wx'});
}catch{console.error('Loader trace sealing BLOCKED; payload suppressed');process.exitCode=2;}
