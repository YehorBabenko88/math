// NON_QUALIFYING: ordinary hosted parent-token cmdlet resolution only.
// This never executes or modifies the restricted worker, flags or deadlines.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,realpathSync} from 'node:fs';
import {hostname} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {childEnv} from './offline-preflight.mjs';

export function programs(){
 const parse="$p='{\"value\":7}'|";
 const tail=";if($p.value -ne 7){exit 3};[Console]::Out.Write('JSON_PROBE_OK')";
 const pre="$ErrorActionPreference='Stop';";
 return [
  ['UNQUALIFIED',pre+parse+'ConvertFrom-Json'+tail],
  ['QUALIFIED',pre+parse+'Microsoft.PowerShell.Utility\\ConvertFrom-Json'+tail],
  ['FIXED_INBOX_IMPORT',pre+"Import-Module -Name ([IO.Path]::Combine($PSHOME,'Modules','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Utility.psd1')) -ErrorAction Stop;"+parse+'Microsoft.PowerShell.Utility\\ConvertFrom-Json'+tail],
 ];
}
export function outcome(result){
 if(result?.error?.code==='ETIMEDOUT')return 'DEADLINE';
 if(result?.error)return 'SPAWN_UNAVAILABLE';
 if(result?.status===0&&result.stdout==='JSON_PROBE_OK'&&result.stderr==='')return 'JSON_PARSED';
 return 'PROCESS_REJECTED';
}
export function hostedContext(env,platform,computer){
 const expected={GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'Windows',GITHUB_REPOSITORY:'YehorBabenko88/math'};
 if(platform!=='win32'||Object.entries(expected).some(([k,v])=>env[k]!==v)||/ADMINIT|LS5|LS7|PC[1-4]/i.test(computer.replace(/[^a-z0-9]/gi,'')))throw Error('HOSTED_DIAGNOSTIC_REQUIRED');
 if(!/^[0-9]+$/.test(env.GITHUB_RUN_ID??'')||!/^[0-9]+$/.test(env.GITHUB_RUN_ATTEMPT??''))throw Error('HOSTED_DIAGNOSTIC_REQUIRED');
}
function main(){
 hostedContext(process.env,process.platform,hostname());
 const git=(...args)=>{const r=spawnSync('git',args,{encoding:'utf8',timeout:10000,maxBuffer:4096,windowsHide:true});if(r.status!==0||r.error||r.stderr)throw Error('SOURCE_REJECTED');return r.stdout.trim();};
 const head=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
 if(!/^[a-f0-9]{40}$/.test(head)||git('status','--porcelain','--untracked-files=normal')!=='')throw Error('SOURCE_REJECTED');
 const temporary=realpathSync.native(process.env.RUNNER_TEMP);
 const root=join(temporary,'math-json-cmdlet-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT);
 mkdirSync(root); // Exclusive fresh namespace, never adopt/delete an old probe.
 const ps=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 const pin=createHash('sha256').update(readFileSync(ps)).digest('hex');
 const results=[];
 for(const [variant,script]of programs()){
  const own=join(root,variant);mkdirSync(own);
  const env={...childEnv(),TEMP:own,TMP:own,PSModuleAnalysisCachePath:join(own,'module.cache'),PSModulePath:join(dirname(ps),'Modules')};
  const observed=spawnSync(ps,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{env,encoding:'utf8',timeout:10000,maxBuffer:1024,windowsHide:true,stdio:['ignore','pipe','pipe']});
  results.push({variant,outcome:outcome(observed),qualification:'NONE'});
 }
 if(git('rev-parse','HEAD')!==head||git('status','--porcelain','--untracked-files=normal')!=='')throw Error('SOURCE_REJECTED');
 const report={schema:'math.hosted-json-cmdlet-probe.v1',scope:'NON_QUALIFYING_ORDINARY_PARENT_TOKEN_ONLY',head,tree,powershell_sha256:pin,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,restricted_worker_modified:false,native_qualification:'NONE',results};
 writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({scope:report.scope,results}));
 return results.every(x=>x.outcome==='JSON_PARSED')?0:1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{process.exitCode=main();}catch{console.error('JSON_CMDLET_PROBE_REJECTED');process.exitCode=1;}
}
