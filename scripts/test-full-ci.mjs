// One authoritative, unfiltered inventory; no shell expansion or optional DB/PDF skips.
import {spawn,spawnSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {admittedErrorCode,admittedFailureType,admittedDiagnosticPhase} from './math-module-diagnostics.mjs';

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

// Diagnostic-only identities come exclusively from the existing expected
// inventory. These functions neither validate evidence nor grant success.
export function terminalFailureAnnotations(events,expected){
 const key=x=>JSON.stringify([x.file,x.parent??null,x.name,x.occurrence]);
 const trusted=new Set(expected.map(key)),occurrences=new Map(),lines=[];
 let nonpass=0,matched=0;
 for(const event of events){
  const base=JSON.stringify([event.file,event.parent??null,event.name]);
  const occurrence=(occurrences.get(base)??0)+1;occurrences.set(base,occurrence);
  if(!['fail','cancelled','skip','todo'].includes(event.status))continue;
  nonpass++;const identity=key({...event,occurrence});
  if(!trusted.has(identity))continue;
  matched++;
  if(lines.length<32){
   const id=createHash('sha256').update(identity).digest('hex');
   lines.push('::error title=Mandatory test failed::FULL_CI_TERMINAL case_id='+id+' status='+event.status+' code='+admittedErrorCode(event.diagnostic_code)+' type='+admittedFailureType(event.diagnostic_type)+' phase='+admittedDiagnosticPhase(event.diagnostic_phase));
  }
 }
 if(nonpass)lines.push('::error title=Mandatory terminal evidence failed::FULL_CI_TERMINAL_SUMMARY matched='+matched+' unmatched='+String(nonpass-matched)+' emitted='+lines.length+' truncated='+(matched>lines.length?'yes':'no'));
 return lines;
}
const failureReasons={ARGUMENTS:'FILTER_POLICY_REJECTED',LOAD_INVENTORY:'INVENTORY_UNAVAILABLE',SOURCE_PROOF:'SOURCE_PROOF_REJECTED',PLATFORM_PREREQUISITES:'RUNTIME_UNSUPPORTED',LINUX_ENVIRONMENT:'REQUIRED_ENVIRONMENT_REJECTED',PDF_PREREQUISITES:'PDF_DEPENDENCIES_UNAVAILABLE',POSTGRES_PREREQUISITES:'POSTGRES_PREREQUISITES_UNAVAILABLE',WINDOWS_PREREQUISITES:'WINDOWS_SHELL_OR_COMPILER_UNAVAILABLE',TEST_RUN:'TEST_PROCESS_UNAVAILABLE',EVENT_PARSE:'MACHINE_EVIDENCE_REJECTED',EVENT_VALIDATION:'TERMINAL_SUITE_REJECTED',SOURCE_RECEIPT:'SOURCE_RECEIPT_REJECTED',EVIDENCE_WRITE:'EVIDENCE_IO_REJECTED'};
function failureAnnotation(stage){
 const known=Object.hasOwn(failureReasons,stage)?stage:'UNCLASSIFIED';
 return '::error title=Mandatory full CI failed::FULL_CI_FAILURE stage='+known+' reason='+(failureReasons[known]??'UNEXPECTED_FAILURE');
}
let mainStage='ARGUMENTS';

async function main(){
 if(process.argv.length!==2)throw Error('Full CI accepts no test selectors or filters');
 if(/--test(?:\b|[-=])/.test(process.env.NODE_OPTIONS??''))throw Error('Test filters are forbidden');
 mainStage='LOAD_INVENTORY';const {readFileSync,writeFileSync,mkdirSync}=await import('node:fs');
 const {execFileSync}=await import('node:child_process');
 const {loadInventory,verifySourceProof,expectedFor,validateEvents,parseEventEvidence,inventoryDigest,sha256}=await import('./platform-coverage.mjs');
 mainStage='LOAD_INVENTORY';const inventory=loadInventory();mainStage='SOURCE_PROOF';const proof=verifySourceProof();mainStage='PLATFORM_PREREQUISITES';const platform=process.platform==='win32'?'windows':process.platform;
 if(!['linux','windows'].includes(platform)||!['22','24'].includes(process.versions.node.split('.')[0]))throw Error('Mandatory platform/Node runtime required');
 let postgres=null,postgresVersion=null;
 if(platform==='linux'){
  mainStage='LINUX_ENVIRONMENT';validateFullCiEnvironment(process.env);
  mainStage='PDF_PREREQUISITES';
  const python=spawnSync(process.env.BOOK_INGESTION_PYTHON,['-c','import pypdf, pypdfium2, PIL'],{windowsHide:true,timeout:15000,stdio:'ignore'});
  if(python.error||python.status!==0)throw Error('Native PDF dependencies unavailable');
  mainStage='POSTGRES_PREREQUISITES';const {default:pg}=await import('pg');
  const pool=new pg.Pool({connectionString:process.env.MATH_UNIVERSE_TEST_DATABASE_URL,max:1,connectionTimeoutMillis:5000,query_timeout:10000});
  try{postgresVersion=(await pool.query("SELECT current_setting('server_version') AS version")).rows[0].version;if(!/^(16|18)\./.test(postgresVersion))throw Error('Full CI requires PostgreSQL16/18');postgres=postgresVersion.split('.')[0];}finally{await pool.end();}
 }else{
  mainStage='WINDOWS_PREREQUISITES';
  // The offline fixture is explicitly disposable-hosted-only; never spoof this locally.
  if(process.env.GITHUB_ACTIONS!=='true'||!process.env.RUNNER_TEMP)throw Error('Windows mandatory lane requires disposable GitHub hosted runtime');
  for(const shell of ['powershell.exe','pwsh.exe']){
   const run=spawnSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';if(-not [IO.File]::Exists(($env:WINDIR+'/Microsoft.NET/Framework64/v4.0.30319/csc.exe'))){exit 2};'WINDOWS_DEPENDENCIES_PASS'"],{encoding:'utf8',windowsHide:true,timeout:15000});
   if(run.error||run.status!==0||run.stdout.trim()!=='WINDOWS_DEPENDENCIES_PASS')throw Error('Required Windows shell/Framework compiler unavailable');
  }
 }
 mainStage='LOAD_INVENTORY';const expected=expectedFor(inventory,platform);const files=[...new Set(expected.map(x=>x.destination))].sort();
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 mainStage='TEST_RUN';const output=[];let code,signal;
 await new Promise((done,reject)=>{const child=spawn(process.execPath,['--test','--test-concurrency=4','--test-timeout=120000','--test-reporter=./scripts/platform-test-reporter.mjs',...files],{env,windowsHide:true,stdio:['ignore','pipe','inherit']});child.stdout.on('data',chunk=>output.push(chunk));child.once('error',reject);child.once('close',(c,s)=>{code=c;signal=s;done();});});
 mainStage='EVIDENCE_WRITE';const eventsRaw=Buffer.concat(output).toString('utf8');mkdirSync('platform-evidence',{recursive:true});writeFileSync('platform-evidence/events.ndjson',eventsRaw);
 mainStage='EVENT_PARSE';const {events,summary,success}=parseEventEvidence(eventsRaw,inventory);let ok=false;
 mainStage='EVENT_VALIDATION';try{validateEvents(events,expected);if(code!==0||signal||!success||summary.tests!==expected.length||summary.pass!==expected.length||['fail','cancelled','skipped','todo'].some(x=>summary[x]!==0))throw Error('Strict terminal suite failed');ok=true;}catch{for(const line of terminalFailureAnnotations(events,expected))console.error(line);console.error(failureAnnotation(mainStage));}
 mainStage='SOURCE_RECEIPT';const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8'}).trim();const head=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
 if(head!==process.env.GITHUB_SHA)throw Error('Tested HEAD differs from workflow SHA');
 const cell=[platform,process.versions.node.split('.')[0],...(postgres?[postgres]:[])].join('-');
 const receipt={schema:1,cell,head,tree,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,jobId:process.env.GITHUB_JOB,platform:process.platform,node:process.versions.node.split('.')[0],nodeVersion:process.version,postgres,postgresVersion,inventorySha:inventoryDigest(inventory),sourceProofSha:proof.sha,eventsSha:sha256(eventsRaw),events,summary,ok,code,signal};
 mainStage='EVIDENCE_WRITE';writeFileSync('platform-evidence/receipt.json',JSON.stringify(receipt,null,2)+'\n');
 console.log('Mandatory platform result: '+JSON.stringify({cell,tests:expected.length,summary,ok}));if(!ok)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){main().catch(()=>{console.error(failureAnnotation(mainStage));process.exitCode=1;});}
