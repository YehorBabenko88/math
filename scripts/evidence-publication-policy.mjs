import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Publication policy is deliberately bounded to tracked evidence documents.
// It neither certifies history nor filters runtime/hosted artifact payloads.
export function isPublicationSurface(path){
 return /^(?:[^/]*(?:audit|report|acceptance)[^/]*\.(?:md|json|log|tap|xml)|docs\/audits\/.*|docs\/[^/]*audit[^/]*\.(?:md|json|log|tap|xml))$/i.test(path);
}
export function inspectPublication(path,text){
 const findings=[];
 const add=(kind,offset=0)=>findings.push({path,kind,line:text.slice(0,offset).split('\n').length});
 // Only this exact public synthetic root is reviewed; arbitrary Public paths
 // and every real account path remain prohibited on evidence surfaces.
 const reviewedRoot=path==='docs/windows-q01-lab.md' ? String.raw`C:\Users\Public\MathUniverseQ01Lab` : null;
 const account=/(?:[a-z]:[\\/]+Users[\\/]+[^\s`"'<>]+|\/(?:home|Users)\/[^\s`"'<>]+)/gi;
 for(const match of text.matchAll(account))if(match[0]!==reviewedRoot)add('local-account-path',match.index);
 // Do not decode payloads: even synthetic encoding must be reviewed before publication.
 if(/[A-Za-z0-9+/]{160,}={0,2}/.test(text))add('long-encoded-candidate');
 if(path.endsWith('.json')){
  let value;try{value=JSON.parse(text);}catch{add('invalid-json');return findings;}
  const visit=node=>{
   if(!node||typeof node!=='object')return;
   for(const [key,val] of Object.entries(node)){
    if(/^(?:content|data|base64)$/i.test(key)&&val!==null&&val!=='')add('payload-field');
    if(/^(?:machineName|userSid)$/i.test(key)&&val!==null&&val!=='')add('host-identity-field');
    visit(val);
   }
  };visit(value);
 }
 return findings;
}
export function checkTrackedPublication(root=fileURLToPath(new URL('../',import.meta.url))){
 const paths=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(isPublicationSurface);
 return paths.flatMap(path=>inspectPublication(path,readFileSync(resolve(root,path),'utf8')));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const findings=checkTrackedPublication();
 // Findings never include matched or decoded values.
 console.log(JSON.stringify({scope:'tracked evidence documents; current checkout only',findings}));
 if(findings.length)process.exitCode=1;
}
