import {fork,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync,lstatSync,realpathSync} from 'node:fs';
import {join,resolve,relative,isAbsolute,dirname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {writeEvidence} from './evidence.mjs';
import {expectedCasesForProfile,caseDeadlineMs,workerDeadlineMs} from './plan.mjs';
import {executeCase} from './cases.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
const within=(root,path)=>{const r=relative(root,path);return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+sep));};
function noLinks(path){for(let p=resolve(path);;p=dirname(p)){if(existsSync(p)&&lstatSync(p).isSymbolicLink())throw Error('LAB_LINK');if(dirname(p)===p)break;}}
export function parseOptions(args){
 const options={};for(let i=0;i<args.length;i++){
  const key=args[i];if(key==='--lab-admin-pc'){if(options.lab)throw Error('LAB_ARGUMENT');options.lab=true;continue;}
  if(!['--source','--output','--expected-head','--profile'].includes(key)||Object.hasOwn(options,key)||!args[i+1]||args[i+1].startsWith('--'))throw Error('LAB_ARGUMENT');options[key]=args[++i];
 }
 if(!['--source','--output','--expected-head','--profile'].every(k=>options[k])||!/^[a-f0-9]{40}$/.test(options['--expected-head']))throw Error('LAB_ARGUMENT');
 expectedCasesForProfile(options['--profile']);return options;
}
export function executionPolicy(options,env=process.env){
 const source=resolve(options['--source']),output=resolve(options['--output']);
 if(!isAbsolute(options['--source'])||!isAbsolute(options['--output'])||within(source,output)||within(output,source))throw Error('LAB_OVERLAP');
 if(options.lab){
  if(process.platform!=='win32')throw Error('LAB_PLATFORM');
  const root='C:\\Users\\Administrator\\AppData\\Local\\MathUniverseLab';
  if(!within(root,output)||output===root)throw Error('LAB_ROOT');
  const admin=execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-Command','([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'],{encoding:'utf8',timeout:5000,windowsHide:true}).trim();
  if(admin!=='False')throw Error('LAB_ELEVATED');
  // Direct invocation cannot supply a verified inherited Job Object yet.
  throw Error('LAB_WINDOWS_CONTAINMENT_UNAVAILABLE');
 }
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!=='YehorBabenko88/math'||!env.RUNNER_TEMP)throw Error('LAB_NOT_AUTHORIZED');
 const root=join(resolve(env.RUNNER_TEMP),'MathUniverseQ01');if(!within(root,output)||output===root)throw Error('LAB_ROOT');
 noLinks(source);noLinks(output);if(existsSync(output))throw Error('LAB_REUSE');
 if(!['22','24'].includes(process.versions.node.split('.')[0]))throw Error('LAB_NODE');
 return {source,output,root};
}
async function sourceIdentity(source,expected){
 const git=(...args)=>execFileSync('git',['--no-optional-locks','--no-replace-objects','-C',source,...args],{stdio:['ignore','pipe','pipe']});
 const head=git('rev-parse','HEAD').toString().trim();if(head!==expected)throw Error('LAB_HEAD_MISMATCH');
 const before=process.cwd();let identity;
 try{process.chdir(source);const {verifySourceIdentity}=await import(pathToFileURL(join(source,'scripts/verify-source-identity.mjs')).href);identity=verifySourceIdentity(head);}finally{process.chdir(before);}
 const sourceHash=file=>{const bytes=readFileSync(join(source,file)),committed=git('show',head+':'+file);if(!bytes.equals(committed)&&hash(Buffer.from(bytes.toString().replaceAll('\r\n','\n')))!==hash(committed))throw Error('LAB_SOURCE_BYTES');return hash(committed);};
 const harness={};for(const name of ['run','worker','plan','cases','preload','probe','sqlite-probe','fs-probe','evidence','verify','passive-source'])harness[name]=sourceHash('scripts/q01-lab/'+name+'.mjs');
 return {head,tree:identity.committedTreeSha,queueSha256:sourceHash('src/book-ingestion/queue.mjs'),contractSha256:sourceHash('src/book-ingestion/queue-contract.mjs'),textSha256:sourceHash('src/book-ingestion/sqlite-text.mjs'),harnessSha256:hash(JSON.stringify(harness)),trackedSourceSha256:identity.trackedSourceSha256,node:process.versions.node,sqlite:process.versions.sqlite,os:process.platform};
}
class Child{
 constructor(ctx,role,options){
  this.ctx=ctx;this.id='w'+(++ctx.serial);this.messages=[];this.listeners=[];this.pending=true;this.killed=false;this.timedOut=false;
  this.barrierDirectory=join(ctx.workspace,this.id+'-barriers');mkdirSync(this.barrierDirectory);
  const config={source:ctx.source,directory:ctx.directory,role,...options,barrierDirectory:this.barrierDirectory,parentPid:process.pid};
  const env={Q01_WORKER_CONFIG:JSON.stringify(config)};for(const key of ['SystemRoot','WINDIR','PATH'])if(process.env[key])env[key]=process.env[key];env.TEMP=env.TMP=ctx.workspace;
  const args=config.hook?['--import',pathToFileURL(join(here,'preload.mjs')).href]:[];
  this.child=fork(join(here,'worker.mjs'),[],{execArgv:args,cwd:ctx.workspace,env,windowsHide:true,stdio:['ignore','ignore','pipe','ipc'],detached:process.platform!=='win32'});this.pid=this.child.pid;
  let stderrBytes=0;this.child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;});
  this.done=new Promise(resolveDone=>{
   this.child.on('message',message=>{
    if(!message||!['ready','phase','barrier','result'].includes(message.kind))return;
    this.messages.push(message);ctx.log(message.kind,this.id,message.data??{});
    for(const waiter of [...this.listeners])if(waiter.kind===message.kind&&waiter.predicate(message)){clearTimeout(waiter.timer);this.listeners.splice(this.listeners.indexOf(waiter),1);waiter.resolve(message);}
   });
   this.child.once('error',()=>{this.spawnError=true;});
   this.child.once('close',(code,signal)=>{
    this.pending=false;clearTimeout(this.timer);ctx.log('exit',this.id,{code:code??-1,signal:signal??'none',killed:this.killed,timedOut:this.timedOut,stderrBytes});
    for(const w of this.listeners){clearTimeout(w.timer);w.reject(Error('LAB_EARLY_EXIT'));}this.listeners=[];resolveDone({code,signal});
   });
  });
  this.timer=setTimeout(()=>{this.timedOut=true;void this.kill();},workerDeadlineMs);
 }
 wait(kind,predicate=()=>true){const found=this.messages.find(m=>m.kind===kind&&predicate(m));if(found)return Promise.resolve(found);if(!this.pending)return Promise.reject(Error('LAB_EARLY_EXIT'));return new Promise((resolve,reject)=>{const w={kind,predicate,resolve,reject};w.timer=setTimeout(()=>{this.listeners=this.listeners.filter(x=>x!==w);reject(Error('LAB_EVENT_TIMEOUT'));},15000);this.listeners.push(w);});}
 ready(){return this.wait('ready');}
 phase(phase){return this.wait('phase',m=>m.data.phase===phase);}
 barrier(phase){return this.wait('barrier',m=>m.data.phase===phase);}
 start(){this.ctx.log('start',this.id,{});this.child.send({command:'start'});}
 release(phase){this.ctx.log('release',this.id,{phase});if(phase==='native-lock-held')this.child.send({command:'release'});else writeFileSync(join(this.barrierDirectory,phase+'.release'),'released',{flag:'wx'});}
 async result(){const exit=await this.done;if(exit.code!==0||exit.signal||this.timedOut)return {ok:false,error:'LAB_CHILD_EXIT'};const result=this.messages.find(m=>m.kind==='result')?.result;return result??{ok:false,error:'LAB_CHILD_EXIT'};}
 async kill(){if(this.pending){this.killed=true;try{if(process.platform==='win32')this.child.kill('SIGKILL');else process.kill(-this.pid,'SIGKILL');}catch{}await this.done;}}
}
async function main(){
 let options,policy;try{options=parseOptions(process.argv.slice(2));policy=executionPolicy(options);}catch{console.log(JSON.stringify({status:'BLOCKED',q01Status:'OPEN',reason:'execution-policy-or-arguments'}));process.exitCode=2;return;}
 const {source,output,root}=policy,profile=options['--profile'],expectedCases=expectedCasesForProfile(profile);
 let sourceBefore;try{sourceBefore=await sourceIdentity(source,options['--expected-head']);}catch{console.log(JSON.stringify({status:'BLOCKED',q01Status:'OPEN',reason:'unverified-source'}));process.exitCode=2;return;}
 mkdirSync(root,{recursive:true});mkdirSync(output);const workspace=join(output,'workspace');mkdirSync(workspace);
 const events=[],results=[],children=new Set();let sequence=0,aborted=false,activeCase;
 const log=(caseId,event,workerId,data={})=>events.push({seq:++sequence,caseId,workerId,event,atNs:String(process.hrtime.bigint()),data});
 const stop=()=>{aborted=true;if(activeCase)activeCase.closed=true;for(const child of children)void child.kill();};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 for(const [index,id]of expectedCases.entries()){
  const caseWorkspace=join(workspace,'case-'+index);mkdirSync(caseWorkspace);const directory=join(caseWorkspace,'queue');mkdirSync(directory);
  const local=[],assertions=[];let status='PASS',reason='all-assertions-satisfied';log(id,'case-start','parent',{});
  const ctx={workspace:caseWorkspace,source,directory,serial:0,assertions,
   log:(event,workerId,data)=>log(id,event,workerId,data),
   observe:(phase,data)=>log(id,'phase','parent',{phase,...data}),
   check:(pass,name)=>{assertions.push({name:name+'-'+assertions.length,pass:Boolean(pass)});if(!pass)throw Error('LAB_ASSERTION');},
   freshDirectory:name=>{const d=join(caseWorkspace,name);mkdirSync(d);return d;},
   child:(role,config={})=>{if(ctx.closed)throw Error('LAB_CASE_CLOSED');const c=new Child(ctx,role,config);local.push(c);children.add(c);return c;},
   one:async(role,config={})=>{const c=ctx.child(role,config);await c.ready();c.start();return c.result();}
  };
  activeCase=ctx;let deadline,execution;
  try{
   if(aborted){status='BLOCKED';reason='runner-aborted';assertions.push({name:'not-aborted',pass:false});}
   else {execution=executeCase(ctx,id);await Promise.race([execution,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('LAB_CASE_TIMEOUT')),/first-open-/.test(id)?35*60*1000:caseDeadlineMs);})]);}
   if(index===expectedCases.length-1){const after=await sourceIdentity(source,options['--expected-head']);ctx.check(JSON.stringify(after)===JSON.stringify(sourceBefore),'source-unchanged-after-tests');}
  }catch(error){status='FAIL';reason=['LAB_ASSERTION','LAB_CASE_TIMEOUT','LAB_EARLY_EXIT','LAB_EVENT_TIMEOUT'].includes(error.message)?error.message:'LAB_SCENARIO_ERROR';if(!assertions.some(a=>!a.pass))assertions.push({name:'scenario-completed',pass:false});}
  finally{clearTimeout(deadline);ctx.closed=true;await Promise.all(local.map(c=>c.kill()));await execution?.catch(()=>{});for(const c of local)children.delete(c);}
  if(!assertions.length)assertions.push({name:'scenario-completed',pass:status==='PASS'});
  if(assertions.some(a=>!a.pass))status=status==='BLOCKED'?'BLOCKED':'FAIL';
  results.push({id,status,reason,assertions});log(id,'case-end','parent',{status});
  console.log(JSON.stringify({case:id,status,q01Status:'OPEN'}));
 }
 process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
 const {report}=await writeEvidence({directory:join(output,'evidence'),source:sourceBefore,profile,expectedCases,results,events});
 console.log(JSON.stringify({status:report.status,q01Status:'OPEN',cases:results.length}));process.exitCode=report.status==='PASS'?0:report.status==='BLOCKED'?2:1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Laboratory failed; private input suppressed. Q01 OPEN.');process.exitCode=1;});
