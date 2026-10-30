import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const sha=b=>createHash('sha256').update(b).digest('hex');
export const caseId=c=>c.file+'::'+c.name;
export function loadPolicy(){
 const p=JSON.parse(readFileSync(new URL('./ci-platform-policy.json',import.meta.url)));
 assert.equal(p.schema,'math.ci.platform-policy.v1');assert.ok(Array.isArray(p.cases)&&p.cases.length>0);
 const seen=new Set();for(const c of p.cases){assert.match(c.file,/^tests\/[a-z0-9-]+\.test\.mjs$/);assert.ok(typeof c.name==='string'&&c.name.length>0);assert.ok(['win32','linux','all'].includes(c.platform));assert.ok(!seen.has(caseId(c)));seen.add(caseId(c));}
 return p;
}
export function fullInventory(){return readdirSync(new URL('../tests/',import.meta.url)).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'tests/'+n);}
export function parseTap(log){
 const matches=[...log.replaceAll('\r\n','\n').matchAll(/\n# tests (\d+)\n# suites (\d+)\n# pass (\d+)\n# fail (\d+)\n# cancelled (\d+)\n# skipped (\d+)\n# todo (\d+)\n# duration_ms [\d.]+/g)];
 assert.ok(matches.length>0,'root TAP summary missing');
 return Object.fromEntries(['tests','suites','pass','fail','cancelled','skipped','todo'].map((k,i)=>[k,Number(matches.at(-1)[i+1])]));
}
export function validateCoverageBundle(receipts,e){
 assert.equal(receipts.length,6,'six required cells');
 const expected=new Set([22,24].flatMap(n=>[`linux-${n}-16`,`linux-${n}-18`,`win32-${n}-null`]));
 const ids=e.policy.cases.map(caseId).sort(),windowsFiles=[...new Set(e.policy.cases.map(c=>c.file))].sort();
 for(const r of receipts){
  assert.equal(r.schema,'math.ci.platform-receipt.v1');
  const key=`${r.platform}-${r.node}-${r.postgres}`;assert.ok(expected.delete(key),'unknown or duplicate cell');
  assert.match(r.nodeVersion,new RegExp('^v'+r.node+'\\.'));assert.equal(r.job,r.platform==='linux'?'postgres-integration':'windows-platform');
  for(const k of ['head','tree','runId','attempt','policyDigest'])assert.equal(r[k],e[k],k);
  assert.equal(r.status,'PASS');assert.deepEqual(r.fullInventory,e.fullInventory);
  assert.deepEqual(r.inventory,r.platform==='linux'?e.fullInventory:windowsFiles);
  assert.ok(Number.isSafeInteger(r.summary.tests)&&r.summary.tests>0);assert.equal(r.summary.pass,r.summary.tests);
  for(const k of ['fail','skipped','cancelled','todo'])assert.equal(r.summary[k],0,k);
  assert.deepEqual(r.cases.map(c=>c.id).sort(),ids,'missing/duplicate/unknown cases');
  for(const c of e.policy.cases){
   const actual=r.cases.find(x=>x.id===caseId(c));
   assert.equal(actual.disposition,c.platform==='all'||c.platform===r.platform?'EXECUTED':'NOT_RUN',caseId(c));
  }
 }
 assert.equal(expected.size,0);return true;
}
export function verifyArtifactFiles(files){
 assert.deepEqual(Object.keys(files).sort(),['SHA256SUMS','result.json','stderr.txt','tests.tap']);
 const r=JSON.parse(files['result.json']),log=files['tests.tap'];
 assert.equal(sha(log),r.testLogSHA256);assert.equal(sha(files['stderr.txt']),r.stderrSHA256);
 assert.deepEqual(parseTap(log.toString()),r.summary);
 const seen=new Set(),lines=files.SHA256SUMS.toString().trim().split(/\r?\n/);
 for(const line of lines){
  const m=line.match(/^([a-f0-9]{64})  (result\.json|tests\.tap|stderr\.txt)$/);assert.ok(m);assert.ok(!seen.has(m[2]),'duplicate checksum');seen.add(m[2]);
  assert.equal(sha(files[m[2]]),m[1]);
 }
 assert.deepEqual([...seen].sort(),['result.json','stderr.txt','tests.tap']);return r;
}
function main(){
 const dir=resolve(process.argv[2]??'');assert.equal(process.argv.length,3);
 const policy=loadPolicy(),git=(...a)=>execFileSync('git',['--no-replace-objects',...a],{encoding:'utf8'}).trim();
 const e={head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,policy,policyDigest:sha(JSON.stringify(policy)),fullInventory:fullInventory()};
 assert.equal(e.head,process.env.GITHUB_SHA);assert.match(e.runId,/^[1-9][0-9]*$/);assert.match(e.attempt,/^[1-9][0-9]*$/);
 const receipts=[];
 for(const folder of readdirSync(dir,{withFileTypes:true})){
  assert.ok(folder.isDirectory());const base=join(dir,folder.name),files={};
  for(const member of readdirSync(base,{withFileTypes:true})){assert.ok(member.isFile()&&!member.isSymbolicLink());files[member.name]=readFileSync(join(base,member.name));}
  receipts.push(verifyArtifactFiles(files));
 }
 validateCoverageBundle(receipts,e);
 const out={schema:'math.ci.coverage-result.v1',status:'PASS',head:e.head,tree:e.tree,runId:e.runId,attempt:e.attempt,requiredCells:6,postgresCells:4,windowsCells:2,platformCases:policy.cases.length,policyDigest:e.policyDigest,receipts:receipts.map(r=>({platform:r.platform,node:r.node,postgres:r.postgres,testLogSHA256:r.testLogSHA256}))};
 const data=JSON.stringify(out,null,2);writeFileSync('full-ci-coverage.json',data);
 writeFileSync('full-ci-coverage.SHA256SUMS',sha(data)+'  full-ci-coverage.json\n');console.log(JSON.stringify(out));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{main();}catch(e){console.error('FULL_COVERAGE_BLOCKED: '+e.message);process.exitCode=1;}}
