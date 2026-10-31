import {createServer} from 'node:http';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash,timingSafeEqual} from 'node:crypto';
import {lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {dirname,resolve,isAbsolute,join} from 'node:path';
import {devNull} from 'node:os';
import {execFileSync} from 'node:child_process';
const MAX_BYTES=262144;
let moduleStartupRejected=false;
let evaluateUnitRequest,executeScientificGraph,scientificCapabilities,runBoundedExperiment,evaluateReturnResearch,evaluateResearchGraph,compilePortGraph,evaluateFormulaDocument;
export function decodeMathBody(chunks,expectedLength){
 const bytes=Buffer.concat(chunks);
 if(bytes.length!==expectedLength||bytes.length>MAX_BYTES)throw Error('BODY_LIMIT');
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export function evaluateMathRequest(body) {
 if(moduleStartupRejected)throw Error('MODULE_STARTUP_REJECTED');
 if(!body||typeof body!=='object'||Array.isArray(body)||body.schema!=='math.evaluate.v1'||body.mode!=='HISTORICAL_RESEARCH'||body.execution_authority!==false)
  throw Error('INVALID_CONTRACT');
 if(!Array.isArray(body.closes)||body.closes.length<500||body.closes.length>2000||
   body.closes.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<=0))throw Error('INVALID_CLOSES');
 if(Object.keys(body).sort().join(',')!=='closes,execution_authority,mode,schema')throw Error('UNKNOWN_FIELDS');
 const r=evaluateReturnResearch(body.closes,{windowSize:500,stride:500,lookback:20,
   alphas:[0,.1,.25,.5],maxVolMultiple:2});
 return {schema:'math.result.v1',source:'CALLER_SUPPLIED_UNATTESTED',
  model:'lagged-log-return-mean-v1',windows:r.windows.map(w=>({
   start:w.start,selected:w.selected,alpha:w.alpha,
   trainCount:w.trainCount,validationCount:w.validationCount,testCount:w.testCount,
   validation:w.validation,test:w.test.selected
  })),status:'RESEARCH_ONLY',trading_authorized:false,execution_authority:false,
  training_authorized:false};
}
const GIT_NULL=process.platform==='win32'?'nul':devNull;
const OWNED_KEYS=['UNIFIED_MODULE_ID','UNIFIED_MODULE_VERSION','UNIFIED_RELEASE_ID','UNIFIED_INSTANCE_TOKEN','UNIFIED_SOURCE_COMMIT','UNIFIED_GIT_EXECUTABLE','UNIFIED_GIT_SHA256'];
function pathFacts(path,optional=false){
 const chain=[];for(let part=resolve(path);;part=dirname(part)){chain.unshift(part);if(dirname(part)===part)break;}
 let info;
 for(let i=0;i<chain.length;i++){
  try{info=lstatSync(chain[i]);}catch(error){if(optional&&error.code==='ENOENT')return null;throw error;}
  if(info.isSymbolicLink()||i<chain.length-1&&!info.isDirectory())throw Error('SOURCE');
 }
 return info;
}
function regular(path,limit,pinnedRuntime=false){
 const info=pathFacts(path);if(!info.isFile()||info.nlink<1||!pinnedRuntime&&info.nlink!==1||info.size>limit)throw Error('SOURCE');
 return readFileSync(path);
}
function checkLocalGitConfig(root){
 const metadata=join(root,'.git');if(!pathFacts(metadata).isDirectory())throw Error('SOURCE');
 for(const path of ['commondir','config.worktree','objects/info/alternates','objects/info/http-alternates','refs/replace','info/grafts','info/attributes'])if(pathFacts(join(metadata,path),true))throw Error('SOURCE');
 const pack=join(metadata,'objects/pack'),packInfo=pathFacts(pack,true);
 if(packInfo){
  if(!packInfo.isDirectory())throw Error('SOURCE');const names=readdirSync(pack);if(names.length>1024)throw Error('SOURCE');
  for(const name of names){if(name.toLowerCase().endsWith('.promisor'))throw Error('SOURCE');pathFacts(join(pack,name));}
 }
 const text=new TextDecoder('utf-8',{fatal:true}).decode(regular(join(metadata,'config'),65536));let section='';
 const core=new Set(['repositoryformatversion','filemode','bare','logallrefupdates','ignorecase','symlinks','autocrlf','fsmonitor','hookspath','attributesfile','precomposeunicode']);
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim();if(!line||line.startsWith('#')||line.startsWith(';'))continue;
  const header=line.match(/^\[(core|remote "[A-Za-z0-9._/-]+"|branch "[A-Za-z0-9._/-]+")\]$/i);
  if(header){section=header[1].toLowerCase();continue;}
  const pair=line.match(/^([A-Za-z][A-Za-z0-9-]*)\s*=\s*(.*?)\s*$/);if(!pair||!section||line.endsWith('\\'))throw Error('SOURCE');
  const key=pair[1].toLowerCase(),value=pair[2].replace(/^"(.*)"$/,'$1');
  if(section==='core'){
   if(!core.has(key)||key==='fsmonitor'&&value!=='false'||key==='bare'&&value!=='false'||key==='repositoryformatversion'&&value!=='0')throw Error('SOURCE');
   if(['attributesfile','hookspath'].includes(key)&&![GIT_NULL.toLowerCase(),devNull.toLowerCase()].includes(value.toLowerCase()))throw Error('SOURCE');
  }else if(section.startsWith('remote ')&&!['url','fetch'].includes(key)||section.startsWith('branch ')&&!['remote','merge','rebase'].includes(key))throw Error('SOURCE');
 }
}
function sourceBound(env){
 const root=resolve(fileURLToPath(new URL('../',import.meta.url))),gitPath=env.UNIFIED_GIT_EXECUTABLE,expected=env.UNIFIED_SOURCE_COMMIT;
 if(process.platform==='win32'&&(!/^[A-Za-z]:\\/.test(root)||!/^[A-Za-z]:\\/.test(gitPath)))throw Error('SOURCE');
 if(!isAbsolute(gitPath)||!/[\/]/.test(gitPath)||createHash('sha256').update(regular(gitPath,134217728,true)).digest('hex')!==env.UNIFIED_GIT_SHA256)throw Error('SOURCE');
 checkLocalGitConfig(root);
 const childEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));
 Object.assign(childEnv,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:GIT_NULL,GIT_CONFIG_GLOBAL:GIT_NULL,GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0'});
 const deadline=Date.now()+5000;
 const git=(...args)=>{
  const remaining=deadline-Date.now();if(remaining<=0)throw Error('SOURCE');
  return execFileSync(gitPath,['--no-replace-objects','--no-optional-locks','-c','core.fsmonitor=false','-c','core.untrackedCache=false','-c','core.hooksPath='+GIT_NULL,'-c','core.attributesFile='+GIT_NULL,'-C',root,...args],{env:childEnv,timeout:Math.min(1500,remaining),maxBuffer:4194304,windowsHide:true,stdio:['ignore','pipe','pipe']});
 };
 if(realpathSync.native(git('rev-parse','--show-toplevel').toString().trim())!==realpathSync.native(root)||git('rev-parse','HEAD').toString().trim()!==expected)throw Error('SOURCE');
 if(git('diff-index','--cached','--name-only',expected,'--').length)throw Error('SOURCE');
 const entries=new TextDecoder('utf-8',{fatal:true}).decode(git('ls-tree','-rz','--full-tree',expected)).split('\0').filter(Boolean);
 if(!entries.length||entries.length>20000)throw Error('SOURCE');let total=0;const paths=new Set();
 for(const entry of entries){
  const match=entry.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/s);if(!match)throw Error('SOURCE');
  const [,mode,blob,path]=match;if(path.split('/').some(p=>!p||p==='.'||p==='..')||path.includes('\\')||path.includes(':'))throw Error('SOURCE');
  const bytes=regular(join(root,path),16777216);total+=bytes.length;if(total>67108864)throw Error('SOURCE');
  const observed=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');if(observed!==blob)throw Error('SOURCE');paths.add(path);
 }
 if(!paths.has('src/math-engine-server.mjs')||git('status','--porcelain=v1','-z','--untracked-files=all').length)throw Error('SOURCE');
}
function numericalBaseline(){
 // Deliberately synthetic offline arithmetic. No market receipt, historical
 // admission, training or execution authority follows from this baseline.
 const result=evaluateMathRequest({schema:'math.evaluate.v1',mode:'HISTORICAL_RESEARCH',execution_authority:false,closes:Array(500).fill(100)});
 const w=result.windows[0];if(result.windows.length!==1||w.trainCount!==300||w.validationCount!==100||w.testCount!==100||w.validation.modelRMSE!==0||w.test.rmse!==0||result.execution_authority!==false||result.trading_authorized!==false||result.training_authorized!==false)throw Error('NUMERICAL');
 const graph={schema:'math.scientific.graph.v2',mode:'HISTORICAL_RESEARCH',execution_authority:false,asOf:3,nodes:[{id:'s',kind:'source',type:'series',unit:'dimensionless',values:[1,2,3],timestamps:[1,2,3],availableAt:[1,2,3],provenance:{sourceId:'synthetic-offline-selftest',version:'selftest-v1',sha256:'a'.repeat(64)}},{id:'f',kind:'formula',expression:'x*2',outputUnit:'dimensionless'}],edges:[{from:{node:'s',port:'value'},to:{node:'f',port:'x'}}],outputs:[{node:'f',port:'value'}]};
 const output=executeScientificGraph(graph);if(JSON.stringify(output.outputs[0].values)!=='[2,4,6]'||output.execution_authority!==false||output.trading_authorized!==false)throw Error('NUMERICAL');
}
function ownedReadiness(){
 if(!OWNED_KEYS.some(key=>Object.hasOwn(process.env,key)))return null;
 try{
  const env=Object.fromEntries(OWNED_KEYS.map(key=>[key,process.env[key]]));
  if(env.UNIFIED_MODULE_ID!=='math'||!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]{1,40})?$/.test(env.UNIFIED_MODULE_VERSION??'')||!/^[A-Za-z0-9_.:-]{1,128}$/.test(env.UNIFIED_RELEASE_ID??'')||!/^[a-f0-9]{64}$/.test(env.UNIFIED_INSTANCE_TOKEN??'')||!/^[a-f0-9]{40}$/.test(env.UNIFIED_SOURCE_COMMIT??'')||!/^[a-f0-9]{64}$/.test(env.UNIFIED_GIT_SHA256??''))throw Error('IDENTITY');
  sourceBound(env);
  return {env,token:Buffer.from(env.UNIFIED_INSTANCE_TOKEN,'ascii')};
 }catch{throw Error('MODULE_STARTUP_REJECTED');}
}
function healthAuthorized(req,owned){
 const values=[];for(let i=0;i<req.rawHeaders.length;i+=2)if(req.rawHeaders[i].toLowerCase()==='authorization')values.push(req.rawHeaders[i+1]);
 if(values.length!==1||!/^Bearer [a-f0-9]{64}$/.test(values[0]))return false;
 const supplied=Buffer.from(values[0].slice(7),'ascii');return timingSafeEqual(supplied,owned.token);
}
// Authenticate owned code before importing any numerical/backend module: a
// dirty module must not gain a top-level side effect before its source check.
let owned=null;
try{owned=ownedReadiness();}catch{moduleStartupRejected=true;}
if(!moduleStartupRejected){
 try{
  const modules=await Promise.all([import('./scientific-unit-api.mjs'),import('./scientific-engine.mjs'),import('./bounded-experiment.mjs'),import('./returns-research.mjs'),import('./math-graph-api.mjs'),import('./port-graph.mjs'),import('./math-formula-api.mjs')]);
  ({evaluateUnitRequest}=modules[0]);({executeScientificGraph,scientificCapabilities}=modules[1]);({runBoundedExperiment}=modules[2]);({evaluateReturnResearch}=modules[3]);({evaluateResearchGraph}=modules[4]);({compilePortGraph}=modules[5]);({evaluateFormulaDocument}=modules[6]);
  if(owned)numericalBaseline();
 }catch(error){if(!owned)throw error;moduleStartupRejected=true;}
}
export function startMathEngine({host='127.0.0.1',port=8788,catalog}={}){
 if(moduleStartupRejected)throw Error('MODULE_STARTUP_REJECTED');
 if(host!=='127.0.0.1'||!Number.isSafeInteger(port)||port<0||port>65535)throw Error('LOOPBACK_ONLY');
 const capabilities=scientificCapabilities(catalog===undefined?{}:{catalog});
 const server=createServer({headersTimeout:5000,requestTimeout:5000,connectionsCheckingInterval:1000},(req,res)=>{
  const reply=(code,obj)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':'none'});
   res.end(JSON.stringify(obj))};
  const hostHeader=req.headers.host;
  if(hostHeader!==`127.0.0.1:${server.address().port}`||req.headers.origin) return reply(403,{error:'LOCAL_ORIGIN_REQUIRED'});
  if(req.url==='/internal/v2/module/health'||req.url.startsWith('/internal/v2/module/health?')){
   if(req.url!=='/internal/v2/module/health')return reply(400,{error:'MODULE_PATH_REQUIRED'});
   if(req.method!=='GET')return reply(405,{error:'MODULE_GET_REQUIRED'});
   if(!owned)return reply(503,{error:'MODULE_UNAVAILABLE'});
   if(!healthAuthorized(req,owned))return reply(403,{error:'MODULE_AUTH_REQUIRED'});
   const ready=OWNED_KEYS.every(key=>process.env[key]===owned.env[key]);
   return reply(200,{module_id:'math',version:owned.env.UNIFIED_MODULE_VERSION,release_id:owned.env.UNIFIED_RELEASE_ID,instance_token:owned.env.UNIFIED_INSTANCE_TOKEN,ready});
  }
  if(req.url==='/healthz'&&req.method==='GET')return reply(200,{service:'math-engine',
   schema:'math.engine.v1',state:'READY_OFFLINE',market_source:'NOT_CONNECTED',trading_authorized:false});
  if(req.url==='/v2/catalog'&&req.method==='GET')return reply(200,capabilities);
  if(!['/v1/evaluate','/v1/graph/execute','/v1/graph/ports','/v1/formula','/v1/experiments','/v2/graph/execute','/v2/units/describe'].includes(req.url)||req.method!=='POST')return reply(404,{error:'NOT_FOUND'});
  if(req.headers['content-type']!=='application/json')return reply(415,{error:'CONTENT_TYPE'});
  const len=Number(req.headers['content-length']);
  if(!Number.isSafeInteger(len)||len<2||len>MAX_BYTES)return reply(413,{error:'BODY_LIMIT'});
  let count=0;const chunks=[];
  const bodyDeadline=req.url==='/v1/experiments'?setTimeout(()=>{if(!res.headersSent)reply(408,{error:'BODY_DEADLINE_EXCEEDED'});req.destroy()},1000):null;
  res.once('close',()=>clearTimeout(bodyDeadline));
  req.on('error',()=>clearTimeout(bodyDeadline));
  req.setTimeout(5000,()=>{if(!res.headersSent)reply(408,{error:'REQUEST_TIMEOUT'});req.destroy()});
  req.on('data',chunk=>{count+=chunk.length;if(count>MAX_BYTES){if(!res.headersSent)reply(413,{error:'BODY_LIMIT'});req.destroy();return}chunks.push(chunk)});
  req.on('end',()=>{clearTimeout(bodyDeadline);if(res.writableEnded)return;try{if(count!==len)throw Error('LENGTH_MISMATCH');
   const payload=decodeMathBody(chunks,len);if(req.url==='/v1/experiments'){const controller=new AbortController();res.once('close',()=>controller.abort());runBoundedExperiment(payload,{signal:controller.signal}).then(out=>{if(!res.destroyed)reply(200,out)},err=>{if(!res.destroyed)reply(422,{error:err.message,execution_authority:false,trading_authorized:false})});return;}const out=req.url==='/v2/units/describe'?evaluateUnitRequest(payload):req.url==='/v2/graph/execute'?executeScientificGraph(payload,catalog===undefined?{}:{catalog}):req.url==='/v1/formula'?evaluateFormulaDocument(payload):req.url==='/v1/graph/ports'?evaluateResearchGraph(compilePortGraph(payload)):req.url==='/v1/graph/execute'?evaluateResearchGraph(payload):evaluateMathRequest(payload);reply(200,out)}
   catch{reply(422,req.url.startsWith('/v2/')?{schema:'math.error.v2',error:'INVALID_SCIENTIFIC_REQUEST',execution_authority:false,trading_authorized:false}:{error:'INVALID_RESEARCH_REQUEST',trading_authorized:false})}});
 });
 server.maxConnections=8;server.maxRequestsPerSocket=32;
 return server.listen(port,host);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const port=Number(process.env.MATH_ENGINE_PORT??8788);
  const server=startMathEngine({port});
  server.once('listening',()=>console.log('MATH_ENGINE_OFFLINE_READY 127.0.0.1:'+server.address().port));
 }catch{console.error('MATH_ENGINE_STARTUP_REJECTED');process.exitCode=1;}
}
