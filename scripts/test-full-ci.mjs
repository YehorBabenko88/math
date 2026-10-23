// One authoritative, unfiltered inventory; no shell expansion or optional DB/PDF skips.
import {spawn,spawnSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export async function runStrictTests({files,quiet=false,env=process.env}){
 if(!Array.isArray(files)||!files.length)throw Error('Nonempty test inventory required');
 if(/--test(?:\b|[-=])/.test(env.NODE_OPTIONS??''))throw Error('Test filters are forbidden');
 // Fixture suites invoked by our own tests need a fresh test-runner context.
 const childEnv={...env};delete childEnv.NODE_TEST_CONTEXT;
 return new Promise((done,reject)=>{
  const child=spawn(process.execPath,['--test','--test-concurrency=4','--test-timeout=120000','--test-reporter=tap',...files],{env:childEnv,windowsHide:true,stdio:['ignore','pipe',quiet?'ignore':'inherit']});
  const placeholders=files.map(file=>'# Subtest: '+resolve(file).replaceAll('\\','\\\\')+'\n');
  let tail='',emptyFile=false;child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{tail=(tail+chunk).slice(-65536);if(placeholders.some(marker=>tail.replaceAll('\r\n','\n').includes(marker)))emptyFile=true;if(!quiet)process.stdout.write(chunk);});
  child.once('error',reject);
  child.once('close',(code,signal)=>{
   // Require the runner's final root summary, not a successful exit alone.
   const match=tail.match(/\n# tests (\d+)\r?\n# suites (\d+)\r?\n# pass (\d+)\r?\n# fail (\d+)\r?\n# cancelled (\d+)\r?\n# skipped (\d+)\r?\n# todo (\d+)\r?\n# duration_ms [\d.]+\s*$/);
   const summary=match?Object.fromEntries(['tests','suites','pass','fail','cancelled','skipped','todo'].map((key,i)=>[key,Number(match[i+1])])):null;
   const ok=code===0&&!signal&&!emptyFile&&summary!==null&&summary.tests>0&&summary.pass===summary.tests&&['fail','cancelled','skipped','todo'].every(key=>summary[key]===0);
   done({ok,code,signal,summary});
  });
 });
}

export function validateFullCiEnvironment(env){
 if(!['22','24'].includes(process.versions.node.split('.')[0]))throw Error('Full CI requires Node 22 or 24');
 if(!env.BOOK_INGESTION_PYTHON)throw Error('Full CI requires BOOK_INGESTION_PYTHON');
 let url;try{url=new URL(env.MATH_UNIVERSE_TEST_DATABASE_URL);}catch{throw Error('Explicit disposable PostgreSQL URL required');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username!=='math_test'||!['/math_universe_test','/math_universe_integration'].includes(url.pathname))throw Error('Full CI permits only local synthetic math_test databases');
}

async function main(){
 if(process.argv.length!==2)throw Error('Full CI accepts no test selectors or filters');
 validateFullCiEnvironment(process.env);
 const python=spawnSync(process.env.BOOK_INGESTION_PYTHON,['-c','import pypdf, pypdfium2, PIL'],{windowsHide:true,timeout:15000,stdio:'ignore'});
 if(python.error||python.status!==0)throw Error('Native PDF dependencies unavailable');
 const {default:pg}=await import('pg');
 const pool=new pg.Pool({connectionString:process.env.MATH_UNIVERSE_TEST_DATABASE_URL,max:1,connectionTimeoutMillis:5000,query_timeout:10000});
 try{
  const {version}= (await pool.query("SELECT current_setting('server_version') AS version")).rows[0];
  if(!/^(16|18)\./.test(version))throw Error('Full CI requires PostgreSQL 16 or 18');
  console.log('Full CI runtime: Node '+process.versions.node+', PostgreSQL '+version);
 }finally{await pool.end();}
 const files=(await readdir(new URL('../tests/',import.meta.url))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>resolve('tests',name));
 console.log('Full CI inventory: '+files.length+' files, no exclusions');
 const result=await runStrictTests({files});
 console.log('Full CI result: '+JSON.stringify(result));
 if(!result.ok)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){main().catch(()=>{console.error('Full CI failed: runtime prerequisite or runner error (connection details suppressed)');process.exitCode=1;});}
