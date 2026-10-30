import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
// Public projection accepts no free text. Raw streams remain private on the runner.
export function projectBootstrapDiagnostic({exitCode,exited,stdout,stderr}){
 if(!Number.isInteger(exitCode)||typeof exited!=='boolean'||typeof stdout!=='string'||typeof stderr!=='string')throw Error('bootstrap observation unavailable');
 return {schema:1,exitCode,exited,
  failure:/^BLOCKED: Medium token assignment BLOCKED win32=5\r?$/m.test(stderr)?'MEDIUM_TOKEN_ACCESS_DENIED':'UNCLASSIFIED',
  cleanup:exited&&/^BOOTSTRAP_CLEANUP_CONFIRMED\r?$/m.test(stdout)?'CONFIRMED_BY_BOOTSTRAP':'UNCONFIRMED',
  nativeAcceptance:'BLOCKED',scope:'bootstrap self-report only; native verifier required'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2],p=JSON.parse(readFileSync(resolve(root,'bootstrap-process.json'),'utf8').replace(/^\uFEFF/,''));
 const d=projectBootstrapDiagnostic({...p,stdout:readFileSync(resolve(root,'bootstrap-stdout.txt'),'utf8'),stderr:readFileSync(resolve(root,'bootstrap-stderr.txt'),'utf8')});
 writeFileSync(resolve(root,'bootstrap-diagnostic.json'),JSON.stringify(d,null,2)+'\n',{flag:'wx'});
}
