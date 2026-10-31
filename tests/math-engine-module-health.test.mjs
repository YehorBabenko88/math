import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync,realpathSync,existsSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir,devNull} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {request} from 'node:http';
const ROOT=resolve('.');
const gitExe=realpathSync(execFileSync(process.platform==='win32'?'where':'which',['git'],{encoding:'utf8'}).trim().split(/\r?\n/)[0]);
const gitPin=createHash('sha256').update(readFileSync(gitExe)).digest('hex');
const token='d'.repeat(64);
function fixture(t,{numericFailure=false,backendMarker=false}={}){
 const root=mkdtempSync(join(tmpdir(),'math-module-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 cpSync(join(ROOT,'src'),join(root,'src'),{recursive:true});
 writeFileSync(join(root,'book-catalog.json'),'{"synthetic":"offline resource"}\n');
 if(backendMarker){const path=join(root,'src/returns-research.mjs');writeFileSync(path,"import{writeFileSync as witness}from'node:fs';witness("+JSON.stringify(join(root,'.git/RESOURCE_IMPORT_EXECUTED'))+",'imported');\n"+readFileSync(path,'utf8'));}
 if(numericFailure){const path=join(root,'src/returns-research.mjs');writeFileSync(path,readFileSync(path,'utf8').replace(' const windows=[];',' throw Error("PRIVATE_NUMERIC_FAILURE");\n const windows=[];'));}
 const git=(...args)=>execFileSync(gitExe,['-c','core.autocrlf=false','-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','source fixture');
 const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('UNIFIED_')||key.startsWith('GIT_'))delete env[key];
 Object.assign(env,{MATH_ENGINE_PORT:'0',UNIFIED_MODULE_ID:'math',UNIFIED_MODULE_VERSION:'1.0.0',UNIFIED_RELEASE_ID:'release-1',UNIFIED_INSTANCE_TOKEN:token,UNIFIED_SOURCE_COMMIT:git('rev-parse','HEAD'),UNIFIED_GIT_EXECUTABLE:gitExe,UNIFIED_GIT_SHA256:gitPin});
 return {root,env,git};
}
async function launch(t,f){
 const child=spawn(process.execPath,[...(f.observer?['--import',f.observer]:[]),join(f.root,'src/math-engine-server.mjs')],{cwd:f.root,env:f.env,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',x=>{stdout+=x});child.stderr.on('data',x=>{stderr+=x});
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}});
 const result=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('bounded startup deadline')),10000);
  const finish=value=>{clearTimeout(timer);resolve(value)};
  child.on('error',reject);child.stdout.on('data',()=>{const m=stdout.match(/MATH_ENGINE_OFFLINE_READY 127\.0\.0\.1:(\d+)/);if(m)finish({port:Number(m[1]),child})});
  child.on('close',code=>finish({code,stdout,stderr}));
 });return result;
}
function get(port,{path='/internal/v2/module/health',authorization='Bearer '+token,method='GET'}={}){
 return new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path,method,headers:authorization===null?{}:{authorization}},res=>{let data='';res.on('data',x=>data+=x);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(data)}))});req.on('error',reject);req.end()});
}
// Diagnostics wrap the existing helper without changing assertions or outcomes.
const originalLaunch=launch;
launch=async function(t,f){
 const {startupCode}=await import('../scripts/math-module-diagnostics.mjs');
 try{const result=await originalLaunch(t,f);t.diagnostic('MATH_MODULE_FIXTURE code='+startupCode(result));return result;}
 catch(error){t.diagnostic('MATH_MODULE_FIXTURE code='+startupCode(null,error));throw error;}
};
test('owned actual clean Git source and real numerical baseline expose exact authenticated health',async t=>{
 const f=fixture(t),r=await launch(t,f);assert.ok(r.port>0,JSON.stringify(r));
 const health=await get(r.port);assert.equal(health.status,200);assert.deepEqual(health.body,{module_id:'math',version:'1.0.0',release_id:'release-1',instance_token:token,ready:true});
 const normal=await fetch('http://127.0.0.1:'+r.port+'/healthz');assert.equal((await normal.json()).trading_authorized,false);
});
test('private health requires one exact bearer and exact read-only path',async t=>{
 const r=await launch(t,fixture(t));assert.ok(r.port>0);
 for(const authorization of [null,'bearer '+token,'Bearer  '+token,'Bearer '+'e'.repeat(64),['Bearer '+token,'Bearer '+token]]){
  const health=await get(r.port,{authorization});assert.equal(health.status,403);assert.deepEqual(health.body,{error:'MODULE_AUTH_REQUIRED'});
 }
 assert.equal((await get(r.port,{path:'/internal/v2/module/health?tick=1'})).status,400);
 assert.equal((await get(r.port,{method:'POST'})).status,405);
});
test('unowned standalone keeps public APIs but module health is unavailable',async t=>{
 const f=fixture(t);for(const key of Object.keys(f.env))if(key.startsWith('UNIFIED_'))delete f.env[key];
 const r=await launch(t,f);assert.ok(r.port>0);const result=await get(r.port);assert.equal(result.status,503);assert.deepEqual(result.body,{error:'MODULE_UNAVAILABLE'});
});
test('owned malformed identity and wrong external source commit fail before listening',async t=>{
 for(const mutation of [e=>e.UNIFIED_MODULE_VERSION='r1',e=>e.UNIFIED_MODULE_ID='MATH',e=>e.UNIFIED_INSTANCE_TOKEN='bad',e=>e.UNIFIED_SOURCE_COMMIT='e'.repeat(40),e=>delete e.UNIFIED_GIT_SHA256]){
  const f=fixture(t);mutation(f.env);const r=await launch(t,f);assert.equal(r.code,1);assert.equal(r.stdout,'');assert.equal(r.stderr.trim(),'MATH_ENGINE_STARTUP_REJECTED');
 }
});
test('dirty source including assume-unchanged and unsafe local config fail before listening',async t=>{
 for(const kind of ['dirty','hidden','resource','filter','include','fsmonitor','attributes','wrong-git-pin','http-alternates','promisor','objects-link']){
  const f=fixture(t,{backendMarker:kind==='resource'});
  if(kind==='dirty'||kind==='hidden'){
   if(kind==='hidden')f.git('update-index','--assume-unchanged','src/math.mjs');
   const path=join(f.root,'src/math.mjs');writeFileSync(path,readFileSync(path,'utf8')+'\n// drift\n');
  }else if(kind==='resource'){f.git('update-index','--assume-unchanged','book-catalog.json');writeFileSync(join(f.root,'book-catalog.json'),'{"synthetic":"tampered resource"}\n');assert.equal(f.git('status','--porcelain'),'');}
  else if(kind==='wrong-git-pin')f.env.UNIFIED_GIT_SHA256='f'.repeat(64);
  else if(kind==='http-alternates')writeFileSync(join(f.root,'.git/objects/info/http-alternates'),'https://invalid.example/objects\n');
  else if(kind==='promisor'){mkdirSync(join(f.root,'.git/objects/pack'),{recursive:true});writeFileSync(join(f.root,'.git/objects/pack/fixture.promisor'),'');}
  else if(kind==='objects-link'){
   const outside=mkdtempSync(join(tmpdir(),'math-external-'));t.after(()=>rmSync(outside,{recursive:true,force:true}));
   const objects=join(f.root,'.git/objects'),marker=join(f.root,'.git/DESCENDANT_PROBED');rmSync(objects,{recursive:true,force:true});symlinkSync(outside,objects,'junction');
   f.observer=join(f.root,'.git/observe-io.mjs');
   writeFileSync(f.observer,"import fs from'node:fs';import{syncBuiltinESMExports}from'node:module';const prefix="+JSON.stringify(objects)+";const marker="+JSON.stringify(marker)+";for(const name of ['lstatSync','existsSync','readFileSync','readdirSync']){const original=fs[name];fs[name]=function(path,...args){if(String(path).startsWith(prefix+'/')||String(path).startsWith(prefix+'\\\\'))fs.writeFileSync(marker,'probed');return original.call(fs,path,...args)}}syncBuiltinESMExports();\n");
  }
  else if(kind==='attributes')f.git('config','core.attributesFile',join(f.root,'PRIVATE_ATTRIBUTES'));
  else if(kind==='filter')f.git('config','filter.unsafe.clean','PRIVATE_COMMAND');
  else if(kind==='include')f.git('config','include.path',join(f.root,'PRIVATE_CONFIG'));
  else f.git('config','core.fsmonitor','PRIVATE_COMMAND');
  const r=await launch(t,f);assert.equal(r.code,1);assert.equal(r.stdout,'');assert.equal(r.stderr.trim(),'MATH_ENGINE_STARTUP_REJECTED');assert.equal(existsSync(join(f.root,'.git/RESOURCE_IMPORT_EXECUTED')),false);assert.equal(existsSync(join(f.root,'.git/DESCENDANT_PROBED')),false);if(kind==='resource')assert.match(f.git('ls-files','-v','book-catalog.json'),/^h /);
 }
});
test('clean but numerically broken engine fails its actual baseline before listening',async t=>{
 const r=await launch(t,fixture(t,{numericFailure:true}));assert.equal(r.code,1);assert.equal(r.stdout,'');assert.equal(r.stderr.trim(),'MATH_ENGINE_STARTUP_REJECTED');
});

test('dirty backend top-level side effects cannot run before owned source rejection',async t=>{
 const f=fixture(t),path=join(f.root,'src/returns-research.mjs'),marker=join(f.root,'.git/PRIVATE_SIDE_EFFECT');
 writeFileSync(path,"import{writeFileSync}from'node:fs';writeFileSync("+JSON.stringify(marker)+",'unsafe');\n"+readFileSync(path,'utf8'));
 const r=await launch(t,f);assert.equal(r.code,1);assert.equal(r.stderr.trim(),'MATH_ENGINE_STARTUP_REJECTED');assert.equal(existsSync(marker),false);
});

test('owned source capsule null hooks and attributes profile remains valid',async t=>{
 const f=fixture(t),nullPath=process.platform==='win32'?'nul':devNull;
 for(const [key,value] of [['core.hooksPath',nullPath],['core.attributesFile',nullPath],['core.fsmonitor','false']])f.git('config',key,value);
 f.observer=join(f.root,'.git/observe-git-env.mjs');const marker=join(f.root,'.git/LAZY_FETCH_POLICY');
 writeFileSync(f.observer,"import fs from'node:fs';import cp from'node:child_process';import{syncBuiltinESMExports}from'node:module';const original=cp.execFileSync;cp.execFileSync=function(command,args,options){if(args.includes('--no-replace-objects'))fs.appendFileSync("+JSON.stringify(marker)+",String(options.env.GIT_NO_LAZY_FETCH)+String.fromCharCode(10));return original.call(cp,command,args,options)};syncBuiltinESMExports();");
 const r=await launch(t,f);assert.ok(r.port>0,JSON.stringify(r));assert.equal((await get(r.port)).body.ready,true);const flags=readFileSync(marker,'utf8').trim().split('\n');assert.ok(flags.length>0);assert.ok(flags.every(value=>value==='1'));
});
