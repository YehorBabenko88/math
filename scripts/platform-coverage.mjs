import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {relative,resolve} from 'node:path';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const loadInventory=()=>JSON.parse(readFileSync('scripts/platform-test-inventory.json','utf8'));
export const cells=['linux-22-16','linux-22-18','linux-24-16','linux-24-18','windows-22','windows-24'];
export const inventoryDigest=inventory=>sha256(JSON.stringify(inventory));
export function verifySourceProof(proof=JSON.parse(readFileSync('scripts/platform-source-proof.json','utf8')),{read=path=>readFileSync(path)}={}){
 assert.equal(proof.repository,'https://github.com/YehorBabenko88/math');assert.equal(proof.baselineCommit,'0b75c0a3583f9823d2b554806468fa541f20b35c');
 const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8'}).trim();assert.equal(git('rev-parse',proof.baselineCommit+'^{tree}'),proof.baselineTree,'Pinned baseline tree');
 const blobs=git('ls-tree','-r',proof.baselineCommit,'tests').split('\n').filter(x=>x.endsWith('.test.mjs')).map(line=>{const [,blob,path]=/^100644 blob ([a-f0-9]{40})\t(.+)$/.exec(line)??[];assert.ok(blob&&path);return {path,blob};});assert.deepEqual(proof.testFiles.map(({path,blob})=>({path,blob})),blobs,'Original Git blob inventory');
 assert.equal(proof.testFiles.length,188,'All original test files required');
 assert.deepEqual(Object.keys(proof.recipes).sort(),proof.testFiles.map(x=>x.path).sort());
 for(const [path,hash] of Object.entries(proof.destinations))assert.equal(sha256(read(path)),hash,'Original source/assertion bytes changed: '+path);
 for(const source of proof.testFiles){const restored=Buffer.concat(proof.recipes[source.path].map(piece=>read(piece.path).subarray(piece.start,piece.end)));assert.equal(createHash('sha1').update(Buffer.from('blob '+restored.length+'\0')).update(restored).digest('hex'),source.blob,'Reconstructed original Git blob');assert.equal(restored.length,source.bytes,source.path);assert.equal(sha256(restored),source.sha256,'Original source reconstruction: '+source.path);}
 const discover=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const path=directory+'/'+entry.name;return entry.isDirectory()?discover(path):/\.(?:test|windows|cross)\.mjs$/.test(entry.name)?[path]:[];});
 const actual=discover('tests').sort();
 assert.deepEqual(actual,[...Object.keys(proof.destinations),...proof.addedFiles].sort(),'Exact source test-file inventory required');
 return {files:proof.testFiles.length,sha:sha256(JSON.stringify(proof))};
}
export function expectedFor(inventory,platform){assert.ok(['linux','windows'].includes(platform));return inventory.tests.filter(x=>x.platform===platform||x.platform==='cross');}
const key=x=>JSON.stringify([x.file,x.parent??null,x.name,x.occurrence]);
export function validateEvents(events,expected){
 assert.ok(Array.isArray(events)&&events.length>0,'Nonempty terminal event inventory');
 const occurrences=new Map();const actual=events.map(event=>{
  assert.equal(event.status,'pass','Every eligible test must pass without skip/todo/cancellation');
  assert.equal(typeof event.file,'string');assert.equal(typeof event.name,'string');
  const base=JSON.stringify([event.file,event.parent??null,event.name]);const occurrence=(occurrences.get(base)??0)+1;occurrences.set(base,occurrence);
  return {...event,occurrence};
 });
 assert.equal(new Set(expected.map(key)).size,expected.length,'Expected identity duplication');
 assert.deepEqual(actual.map(key).sort(),expected.map(key).sort(),'Exact test identity multiset required');
 return actual;
}
export function validateCoverage(receipts,{inventory=loadInventory(),head,tree,runId,attempt,sourceProofSha}={}){
 assert.deepEqual(receipts.map(x=>x.cell).sort(),[...cells].sort(),'All six mandatory cells exactly once');
 const union=new Set();
 for(const receipt of receipts){
  const [platform,node,postgres]=receipt.cell.split('-');
  for(const [field,value] of Object.entries({head,tree,runId,attempt,sourceProofSha,inventorySha:inventoryDigest(inventory),platform:platform==='windows'?'win32':'linux',node,postgres:postgres??null}))assert.equal(receipt[field],value,'Receipt '+field);
  assert.equal(receipt.ok,true);assert.equal(sha256(receipt.eventsRaw),receipt.eventsSha,'Event evidence digest');const parsed=parseEventEvidence(receipt.eventsRaw,inventory);assert.deepEqual(parsed.events,receipt.events,'Raw events must match parsed records');assert.deepEqual(parsed.summary,receipt.summary,'Raw final summary must match receipt');assert.equal(parsed.success,true,'Actual root success required');
  assert.equal(receipt.nodeVersion.split('.')[0].replace(/^v/,''),node,'Actual Node runtime');
  if(postgres)assert.ok(receipt.postgresVersion.startsWith(postgres+'.'),'Actual PostgreSQL server');
  const events=validateEvents(receipt.events,expectedFor(inventory,platform));
  assert.equal(receipt.summary.tests,events.length);assert.equal(receipt.summary.pass,events.length);
  for(const field of ['fail','cancelled','skipped','todo'])assert.equal(receipt.summary[field],0,'Summary '+field);
  for(const event of events)union.add(key(event));
 }
 assert.deepEqual([...union].sort(),inventory.tests.map(key).sort(),'Unique source identity union');
 return {ok:true,cells:cells.length,uniqueTests:union.size,head,tree,runId,attempt};
}
export function logicalFile(file,inventory){const path=relative(process.cwd(),resolve(file)).replaceAll('\\','/');const originals=[...new Set(inventory.tests.filter(x=>x.destination===path).map(x=>x.file))];assert.equal(originals.length,1,'Unknown/ambiguous actual source file '+path);return originals[0];}

export function parseEventEvidence(raw,inventory){
 const records=raw.trim().split(/\r?\n/).map(line=>JSON.parse(line));
 const summaries=records.filter(x=>x.type==='summary');assert.equal(summaries.length,1,'Exactly one final root summary');assert.equal(records.at(-1).type,'summary','Final summary must terminate evidence');
 const events=records.filter(x=>x.type==='terminal').map(event=>{const sources=[...new Set(inventory.tests.filter(x=>x.destination===event.file||x.file===event.file).map(x=>x.file))];assert.equal(sources.length,1,'Unknown event source');return {...event,file:sources[0]};});
 assert.equal(events.length+1,records.length,'Only test terminal records and root summary accepted');
 const counts=summaries[0].counts;const summary={tests:counts.tests,pass:counts.passed,fail:counts.failed,cancelled:counts.cancelled,skipped:counts.skipped,todo:counts.todo};
 return {events,summary,success:summaries[0].success};
}
