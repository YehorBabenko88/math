// Offline matching/compilation only. This program cannot authorize a token query.
import * as fs from 'node:fs';
import {resolve,dirname,join,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
const fail=()=>{throw Error('PREFLIGHT_BLOCKED');};
const need=x=>{if(!x)fail();};
const hash=(b,kind='sha256')=>createHash(kind).update(b).digest('hex');
const exact=(o,keys)=>need(o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...keys].sort().join('|'));
const hex=(x,n)=>typeof x==='string'&&new RegExp('^[0-9a-f]{'+n+'}$').test(x);
const fold=p=>process.platform==='win32'?p.toLowerCase():p;
export const isWithin=(root,p)=>fold(resolve(p)).startsWith(fold(resolve(root))+sep);
const ownPath=p=>{need(typeof p==='string'&&isAbsolute(p)&&!p.split(/[\\/]/).includes('..'));if(process.platform==='win32')need(/^[a-z]:[\\/]/i.test(p));return resolve(p);};
export function noLinks(p){p=ownPath(p);for(let q=p;;q=dirname(q)){const s=fs.lstatSync(q);need(!s.isSymbolicLink());if(q===dirname(q))break;}return p;}
function bytes(p,limit=16*1024*1024,runtimeLinks=false){noLinks(p);const fd=fs.openSync(p,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));try{const a=fs.fstatSync(fd);need(a.isFile()&&a.nlink>=1&&(runtimeLinks||a.nlink===1)&&a.size<=limit);const b=fs.readFileSync(fd),z=fs.fstatSync(fd),s=fs.lstatSync(p);need(a.dev===z.dev&&a.ino===z.ino&&a.nlink===z.nlink&&a.size===z.size&&a.mtimeMs===z.mtimeMs&&a.ctimeMs===z.ctimeMs&&s.dev===a.dev&&s.ino===a.ino&&!s.isSymbolicLink()&&s.nlink===a.nlink);return b;}finally{fs.closeSync(fd);}}
export function childEnv(input=process.env){const allowed=new Set(['systemroot','windir','systemdrive','temp','tmp','userprofile','localappdata','appdata']);const e={};for(const [k,v] of Object.entries(input))if(allowed.has(k.toLowerCase()))e[k]=v;return{...e,GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',PSModulePath:'',NODE_NO_WARNINGS:'1'};}
function gitRead(root,git,args){return execFileSync(git,['--no-replace-objects','-c','core.fsmonitor=false',...args],{cwd:root,env:childEnv(),windowsHide:true,timeout:15000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});}
function safeName(p){return typeof p==='string'&&p.length>0&&p.length<512&&!/[\\:\x00-\x1f]/.test(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'&&!/[. ]$/.test(x)&&!/^\.git$/i.test(x));}
function validatePins(p){need(hex(p.head,40)&&hex(p.tree,40)&&Array.isArray(p.blobs)&&p.blobs.length>0&&p.blobs.length<=5000);const seen=new Set();for(const b of p.blobs){exact(b,['path','mode','oid','sha256']);need(safeName(b.path)&&['100644','100755'].includes(b.mode)&&hex(b.oid,40)&&hex(b.sha256,64)&&!seen.has(b.path.toLowerCase()));seen.add(b.path.toLowerCase());}}
export function validatePolicy(p){exact(p,['schema','repository','head','tree','blobs','tools']);need(p.schema==='math.g0.offline-policy.v1'&&p.repository==='YehorBabenko88/math');validatePins(p);exact(p.tools,['node','git','powershell','compiler']);for(const k of ['node','git','powershell']){exact(p.tools[k],k==='node'?['path','sha256','version']:['path','sha256']);ownPath(p.tools[k].path);need(hex(p.tools[k].sha256,64));}need(typeof p.tools.node.version==='string'&&/^v(?:22|24)\.\d+\.\d+$/.test(p.tools.node.version));exact(p.tools.compiler,['sha256']);need(hex(p.tools.compiler.sha256,64));return p;}
export function inspectSource(root,git,pins){try{
 root=noLinks(ownPath(root));validatePins(pins);
 const metadata=join(root,'.git');need(fs.lstatSync(metadata).isDirectory());
 function metadataWalk(dir){noLinks(dir);for(const n of fs.readdirSync(dir)){const f=join(dir,n),s=fs.lstatSync(f);need(!s.isSymbolicLink());if(s.isDirectory())metadataWalk(f);else need(s.isFile()&&s.nlink===1);}}metadataWalk(metadata);
 for(const p of ['commondir','config.worktree','objects/info/alternates','objects/info/http-alternates','info/grafts'])need(!fs.existsSync(join(metadata,p)));
 const config=bytes(join(metadata,'config')).toString('utf8');need(!/^\s*\[\s*(?:include(?:if)?|extensions)\b/im.test(config)&&!/^\s*(?:promisor|partialclonefilter)\s*=/im.test(config));
 need(fold(resolve(gitRead(root,git,['rev-parse','--absolute-git-dir']).toString().trim()))===fold(metadata));
 for(const [args,target] of [[['rev-parse','--git-common-dir'],metadata],[['rev-parse','--git-path','objects'],join(metadata,'objects')]])need(fold(resolve(root,gitRead(root,git,args).toString().trim()))===fold(target));
 need(fold(resolve(gitRead(root,git,['rev-parse','--show-toplevel']).toString().trim()))===fold(root));
 // symbolic-ref exits 1 only for detached HEAD; no status/filter invocation.
 const detached=spawnSync(git,['--no-replace-objects','symbolic-ref','-q','HEAD'],{cwd:root,env:childEnv(),windowsHide:true,timeout:15000,stdio:['ignore','pipe','pipe']});need(detached.status===1);
 need(gitRead(root,git,['rev-parse','HEAD']).toString().trim()===pins.head);
 const commit=gitRead(root,git,['cat-file','commit',pins.head]);need(hash(Buffer.concat([Buffer.from('commit '+commit.length+'\0'),commit]),'sha1')===pins.head&&commit.toString().split('\n')[0]==='tree '+pins.tree);
 const tree=gitRead(root,git,['cat-file','tree',pins.tree]);need(hash(Buffer.concat([Buffer.from('tree '+tree.length+'\0'),tree]),'sha1')===pins.tree);
 need(gitRead(root,git,['config','--get','remote.origin.url']).toString().trim()==='https://github.com/YehorBabenko88/math.git');
 const records=gitRead(root,git,['ls-tree','-r','-z',pins.tree]).toString('utf8').split('\0').filter(Boolean).map(x=>{const m=/^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/.exec(x);need(m);return{mode:m[1],oid:m[2],path:m[3]};});
 const index=gitRead(root,git,['ls-files','--stage','-z']).toString('utf8').split('\0').filter(Boolean).map(x=>{const m=/^(100644|100755) ([0-9a-f]{40}) 0\t(.+)$/.exec(x);need(m);return{mode:m[1],oid:m[2],path:m[3]};});
 const expected=pins.blobs.map(({path,mode,oid})=>({mode,oid,path}));need(JSON.stringify(records)===JSON.stringify(expected)&&JSON.stringify(index)===JSON.stringify(expected));
 const names=new Set(pins.blobs.map(b=>b.path)),dirs=new Set();for(const n of names){let d=dirname(n).replaceAll('\\','/');while(d!=='.'){dirs.add(d);d=dirname(d).replaceAll('\\','/');}}
 const found=[];function walk(dir){for(const n of fs.readdirSync(dir)){if(dir===root&&n==='.git'){noLinks(join(dir,n));continue;}const path=join(dir,n),rel=relative(root,path).split(sep).join('/'),s=fs.lstatSync(path);need(!s.isSymbolicLink());if(s.isDirectory()){need(dirs.has(rel));walk(path);}else{need(s.isFile()&&s.nlink===1&&names.has(rel));found.push(rel);}}}walk(root);need(found.length===names.size);
 const captured=new Map();let total=0;for(const b of pins.blobs){const raw=bytes(join(root,...b.path.split('/')));total+=raw.length;need(total<=128*1024*1024&&hash(raw)===b.sha256&&hash(Buffer.concat([Buffer.from('blob '+raw.length+'\0'),raw]),'sha1')===b.oid);captured.set(b.path,raw);}
 return{count:pins.blobs.length,captured};
}catch{fail();}}

export const WINDOWS_WORKER=String.raw`$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$code='RUNTIME';$status='BLOCKED'
function HashFile([string]$p){$s=[IO.File]::OpenRead($p);$h=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($h.ComputeHash($s)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose();$s.Dispose()}}
function NoReparse([string]$p){$p=[IO.Path]::GetFullPath($p);while($p){if(([IO.File]::GetAttributes($p) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Path]::GetDirectoryName($p);if($parent -eq $p){break};$p=$parent}}
function TreeNoReparse([string]$p){NoReparse $p;foreach($e in [IO.Directory]::GetFileSystemEntries($p)){NoReparse $e;if(([IO.File]::GetAttributes($e) -band [IO.FileAttributes]::Directory) -ne 0){TreeNoReparse $e}}}
function NoAdapterTypes {foreach($a in (@([AppDomain]::CurrentDomain.GetAssemblies())+@([AppDomain]::CurrentDomain.ReflectionOnlyGetAssemblies()))){foreach($t in $a.GetTypes()){if($t.FullName.StartsWith('MathUniverse.G0.')){throw 'blocked'}}}}
try {
 NoReparse $env:MATH_PREFLIGHT_PAYLOAD
 $inputBytes=[IO.File]::ReadAllBytes($env:MATH_PREFLIGHT_PAYLOAD)
 if($inputBytes.Length -gt 262144){throw 'blocked'}
 $digest=[Security.Cryptography.SHA256]::Create();try{$actual=[BitConverter]::ToString($digest.ComputeHash($inputBytes)).Replace('-','').ToLowerInvariant()}finally{$digest.Dispose()}
 if($actual -cne $expectedPayloadSha){throw 'blocked'}
 $p=[Text.Encoding]::UTF8.GetString($inputBytes)|ConvertFrom-Json
 if($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or [IntPtr]::Size -ne 8){throw 'blocked'}
 $self=[Diagnostics.Process]::GetCurrentProcess();try{$exe=$self.MainModule.FileName}finally{$self.Dispose()}
 NoReparse $exe;if((HashFile $exe) -cne $p.powershellSha){throw 'blocked'}
 $compiler=[IO.Path]::Combine([Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory(),'csc.exe')
 NoReparse $compiler;if((HashFile $compiler) -cne $p.compilerSha){throw 'blocked'}
 $code='REPARSE';TreeNoReparse $p.sourceRoot;NoReparse $p.scratch
 $code='TYPES';NoAdapterTypes
 $code='PARSER';foreach($text in $p.scripts){$tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseInput([string]$text,[ref]$tokens,[ref]$errors);if($errors.Count -ne 0){throw 'blocked'}}
 $code='COMPILE'
 $providerType=[Microsoft.CSharp.CSharpCodeProvider]
 if($providerType.Assembly.FullName -cne 'System, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089'){throw 'blocked'}
 $provider=[Microsoft.CSharp.CSharpCodeProvider]::new()
 try {
  $params=[CodeDom.Compiler.CompilerParameters]::new()
  $params.GenerateExecutable=$false;$params.GenerateInMemory=$false;$params.TreatWarningsAsErrors=$true
  $params.CompilerOptions='/noconfig /nologo'
  $params.OutputAssembly=[IO.Path]::Combine($p.scratch,'compile-only.dll')
  $params.TempFiles=[CodeDom.Compiler.TempFileCollection]::new($p.scratch,$false)
  if([Linq.Enumerable].Assembly.FullName -cne 'System.Core, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089'){throw 'blocked'}
  [void]$params.ReferencedAssemblies.Add($providerType.Assembly.Location);[void]$params.ReferencedAssemblies.Add([Linq.Enumerable].Assembly.Location)
  try {$result=$provider.CompileAssemblyFromSource($params,[string[]]@([string]$p.csharp));if($result.Errors.HasErrors -or -not [IO.File]::Exists($params.OutputAssembly)){throw 'blocked'}}finally{$params.TempFiles.Dispose()}
 } finally {$provider.Dispose()}
 $code='TYPES';NoAdapterTypes
 $code='REPARSE';TreeNoReparse $p.sourceRoot;NoReparse $p.scratch
 $status='PASS';$code='NONE'
} catch {}
[Console]::Out.WriteLine(('{{"schema":"math.g0.preflight-worker.v1","status":"{0}","code":"{1}"}}' -f $status,$code))
if($status -eq 'PASS'){exit 0}else{exit 2}`;

export function parseWorkerReport(text){try{need(typeof text==='string'&&Buffer.byteLength(text)<=1024);const r=JSON.parse(text);exact(r,['schema','status','code']);need(text.trim()===JSON.stringify(r));need(r.schema==='math.g0.preflight-worker.v1'&&['PASS','BLOCKED'].includes(r.status)&&['NONE','RUNTIME','REPARSE','TYPES','PARSER','COMPILE'].includes(r.code)&&((r.status==='PASS')===(r.code==='NONE')));return r;}catch{fail();}}
export function runtimePin(p){noLinks(p.path);need(hash(bytes(p.path,256*1024*1024,true))===p.sha256);}
const report=(status,code,identity=null)=>({sourceHead:identity?.head??null,sourceTree:identity?.tree??null,sourceBlobs:identity?.count??null,policySha256:identity?.policyHash??null,schema:'math.g0.offline-preflight.v1',status,code,provenance:'PIN_MATCH_ONLY_NOT_ATTESTATION',authority:'NONE',admission:'BLOCKED',localExecute:false,isolationConfirmed:false,physicalCall:'NOT_AUTHORIZED'});
export function runPreflight({source,policy,policySha256}){let stage='POLICY',scratch,labRoot;try{
 need(process.platform==='win32'&&process.arch==='x64'&&process.execArgv.length===0&&!process.env.NODE_OPTIONS&&hex(policySha256,64));
 policy=fs.realpathSync.native(noLinks(ownPath(policy)));
 noLinks(ownPath(process.argv[1]));
 const raw=bytes(policy);need(raw.length<=2*1024*1024&&hash(raw)===policySha256);const p=validatePolicy(JSON.parse(raw.toString('utf8')));need(raw.toString('utf8')===JSON.stringify(p)+'\n');
 stage='ROOT';source=fs.realpathSync.native(noLinks(ownPath(source)));const root=fs.realpathSync.native(noLinks(resolve(process.env.LOCALAPPDATA,'MathUniverseAdminitAcceptance')));labRoot=root;need(isWithin(root,source));noLinks(source);need(!isWithin(source,policy));
 stage='RUNTIME';for(const name of ['node','git','powershell'])runtimePin(p.tools[name]);need(fold(resolve(process.execPath))===fold(resolve(p.tools.node.path))&&process.version===p.tools.node.version);
 stage='SOURCE';const before=inspectSource(source,p.tools.git.path,p);
 // The launched verifier itself must match a reviewed candidate blob, not its name.
 need(hash(bytes(fileURLToPath(import.meta.url)))===p.blobs.find(b=>b.path==='scripts/adminit-containment/offline-preflight.mjs')?.sha256);
 const names=['g0-token-api.ps1','observe-token-api.ps1','collect-g0.ps1'];const scripts=names.map(n=>{const b=before.captured.get('scripts/adminit-containment/'+n);need(b);return b.toString('utf8');});
 const cs=before.captured.get('scripts/adminit-containment/WindowsTokenObservation.cs');need(cs);
 stage='WORKER';scratch=fs.mkdtempSync(join(root,'offline-compile-'));noLinks(scratch);
 const payload=join(scratch,'input.json');const payloadText=JSON.stringify({sourceRoot:source,scratch,powershellSha:p.tools.powershell.sha256,compilerSha:p.tools.compiler.sha256,scripts,csharp:cs.toString('utf8')});fs.writeFileSync(payload,payloadText,{flag:'wx'});
 const worker="$expectedPayloadSha='"+hash(Buffer.from(payloadText))+"';\n"+WINDOWS_WORKER;
 const child=spawnSync(p.tools.powershell.path,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(worker,'utf16le').toString('base64')],{cwd:scratch,env:{...childEnv(),MATH_PREFLIGHT_PAYLOAD:payload,TEMP:scratch,TMP:scratch,PSModuleAnalysisCachePath:join(scratch,'module.cache'),PSDisableModuleAnalysisCacheCleanup:'1',PSModulePath:join(dirname(p.tools.powershell.path),'Modules')},encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:16384});
 need(!child.error&&!child.signal&&child.stderr==='');const result=parseWorkerReport(child.stdout);if(result.status!=='PASS')stage=result.code;need(child.status===0&&result.status==='PASS');
 stage='SOURCE';inspectSource(source,p.tools.git.path,p);for(const name of ['node','git','powershell'])runtimePin(p.tools[name]);
 stage='CLEANUP';cleanScratch(scratch,root);scratch=undefined;
 return report('PASS','NONE',{head:p.head,tree:p.tree,count:p.blobs.length,policyHash:policySha256});
}catch{return report('BLOCKED',stage);}finally{if(scratch){try{cleanScratch(scratch,labRoot);}catch{/* A blocked result cannot become PASS after cleanup. */}}}}
function cleanScratch(p,root){need(dirname(resolve(p))===resolve(root)&&p.startsWith(root+sep+'offline-compile-'));noLinks(p);for(const n of fs.readdirSync(p)){const f=join(p,n),s=fs.lstatSync(f);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1);fs.unlinkSync(f);}fs.rmdirSync(p);}
function isEntry(){if(!process.argv[1])return false;const own=fileURLToPath(import.meta.url);if(fold(resolve(process.argv[1]))===fold(own))return true;try{return fold(fs.realpathSync.native(process.argv[1]))===fold(fs.realpathSync.native(own));}catch{return false;}}
if(isEntry()){
 let result=report('BLOCKED','ARGUMENTS');try{const a=process.argv.slice(2);need(a.length===6&&a[0]==='--source'&&a[2]==='--policy'&&a[4]==='--policy-sha256');result=runPreflight({source:a[1],policy:a[3],policySha256:a[5]});}catch{}
 console.log(JSON.stringify(result));process.exitCode=result.status==='PASS'?0:2;
}
