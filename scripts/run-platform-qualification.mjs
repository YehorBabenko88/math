import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {loadPolicy,fullInventory,sha,parseTap,caseId} from './ci-platform-coverage.mjs';

const mode=process.argv[2];assert.equal(process.argv.length,3);assert.ok(['postgres','windows'].includes(mode));
assert.equal(process.platform,mode==='postgres'?'linux':'win32');assert.equal(process.env.GITHUB_ACTIONS,'true');
const policy=loadPolicy(),output=resolve('.ci-qualification');mkdirSync(output);
const records=join(output,'records');mkdirSync(records);
const env={...process.env,MATH_CI_PLATFORM_PROFILE:mode==='postgres'?'linux-pg':'windows-native',MATH_CI_CASE_RECORDS:records};
const script=mode==='postgres'?'scripts/test-full-ci.mjs':'scripts/test-platform-native-ci.mjs';
const r=spawnSync(process.execPath,[script],{env,encoding:'utf8',timeout:18*60000,maxBuffer:32*1024*1024,windowsHide:true});
const stdout=r.stdout??'',stderr=r.stderr??'';writeFileSync(join(output,'tests.tap'),stdout);writeFileSync(join(output,'stderr.txt'),stderr);
let summary=null;try{summary=parseTap(stdout);}catch{}
const cases=readdirSync(records).map(f=>JSON.parse(readFileSync(join(records,f),'utf8')));
const required=policy.cases.map(caseId).sort();const found=cases.map(c=>c.id).sort();
const complete=JSON.stringify(required)===JSON.stringify(found)&&cases.every(c=>c.policyDigest===sha(JSON.stringify(policy))&&c.platform===process.platform);
const passed=r.status===0&&!r.error&&complete&&summary&&summary.tests>0&&summary.pass===summary.tests&&['fail','skipped','cancelled','todo'].every(k=>summary[k]===0);
const git=(...a)=>execFileSync('git',['--no-replace-objects',...a],{encoding:'utf8'}).trim();
let postgres=null;
if(mode==='postgres'){const {default:pg}=await import('pg');const p=new pg.Pool({connectionString:process.env.MATH_UNIVERSE_TEST_DATABASE_URL,max:1});try{postgres=Number((await p.query("SHOW server_version")).rows[0].server_version.split('.')[0]);}finally{await p.end();}}
const receipt={schema:'math.ci.platform-receipt.v1',status:passed?'PASS':'FAIL',head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,job:process.env.GITHUB_JOB,platform:process.platform,node:Number(process.versions.node.split('.')[0]),nodeVersion:process.version,postgres,policyDigest:sha(JSON.stringify(policy)),fullInventory:fullInventory(),inventory:mode==='postgres'?fullInventory():[...new Set(policy.cases.map(c=>c.file))].sort(),summary,cases,testLogSHA256:sha(stdout),stderrSHA256:sha(stderr)};
const bytes=JSON.stringify(receipt,null,2);writeFileSync(join(output,'result.json'),bytes);
writeFileSync(join(output,'SHA256SUMS'),[['result.json',bytes],['tests.tap',stdout],['stderr.txt',stderr]].map(([n,b])=>sha(b)+'  '+n).join('\n')+'\n');
console.log(stdout);console.log(JSON.stringify({status:receipt.status,head:receipt.head,summary,actual:cases.filter(c=>c.disposition==='EXECUTED').length,routed:cases.filter(c=>c.disposition==='NOT_RUN').length}));
if(!passed)process.exitCode=1;
