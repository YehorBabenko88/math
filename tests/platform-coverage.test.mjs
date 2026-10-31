import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadInventory,validateEvents,validateCoverage,verifySourceProof,sha256} from '../scripts/platform-coverage.mjs';

const identity={file:'tests/example.test.mjs',name:'original',parent:null,occurrence:1,platform:'linux'};
const terminal={file:'tests/example.test.mjs',name:'original',parent:null,status:'pass'};
test('platform identity rejects omitted extra duplicate substituted and nested terminal mutations',()=>{
 assert.equal(validateEvents([terminal],[identity]).length,1);
 for(const events of [[],[terminal,terminal],[{...terminal,name:'substitute'}],[{...terminal,parent:'other'}],[terminal,{...terminal,name:'extra'}]])assert.throws(()=>validateEvents(events,[identity]));
 const nested={...identity,name:'child',parent:'original'};
 assert.equal(validateEvents([terminal,{...terminal,name:'child',parent:'original'}],[identity,nested]).length,2);
 assert.throws(()=>validateEvents([terminal],[identity,nested]));
});
test('platform identity rejects skip todo failed cancelled and fabricated summary-only success',()=>{
 for(const status of ['skip','todo','fail','cancelled',undefined])assert.throws(()=>validateEvents([{...terminal,status}],[identity]));
 assert.throws(()=>validateEvents([{type:'summary',pass:1,tests:1}],[identity]));
});
test('platform inventory preserves baseline1147 identities repeated titles nested children and cross3',()=>{
 const developer=JSON.parse(readFileSync('package.json','utf8'));assert.equal(developer.scripts.test,'node --test tests/*.test.mjs tests/*.windows.mjs tests/*.cross.mjs');
 const inv=loadInventory();assert.equal(inv.tests.filter(x=>!x.added).length,1147);
 assert.equal(inv.tests.filter(x=>!x.added&&x.parent).length,12);
 assert.equal(inv.tests.filter(x=>x.platform==='windows').length,22);
 assert.equal(inv.tests.filter(x=>!x.added&&x.platform==='cross').length,3);
 const healthFile='tests/math-engine-module-health.test.mjs',diagnosticFile='tests/math-module-diagnostics.cross.mjs';
 const scientificCross=inv.tests.filter(x=>x.added&&x.platform==='cross'&&x.file!==healthFile&&x.file!==diagnosticFile);
 assert.equal(scientificCross.length,44);
 assert.equal(sha256(JSON.stringify(scientificCross.map(x=>JSON.stringify([x.file,x.parent??null,x.name,x.occurrence])).sort())),'dc2b3096a5a960fe4ed11b22456ebf744e48b995ad0e67f113049dc875c7561e','Original 44 scientific cross-platform identities unchanged');
 const healthCross=inv.tests.filter(x=>x.added&&x.platform==='cross'&&x.file===healthFile);
 assert.equal(healthCross.length,8);
 assert.deepEqual(healthCross.map(x=>x.name).sort(),["clean but numerically broken engine fails its actual baseline before listening","dirty backend top-level side effects cannot run before owned source rejection","dirty source including assume-unchanged and unsafe local config fail before listening","owned actual clean Git source and real numerical baseline expose exact authenticated health","owned malformed identity and wrong external source commit fail before listening","owned source capsule null hooks and attributes profile remains valid","private health requires one exact bearer and exact read-only path","unowned standalone keeps public APIs but module health is unavailable"]);
 for(const entry of healthCross){assert.equal(entry.destination,healthFile);assert.equal(entry.parent,null);assert.equal(entry.occurrence,1);}
 assert.equal(inv.tests.filter(x=>x.added&&x.platform==='cross'&&x.file===diagnosticFile).length,4);
 assert.equal(inv.tests.filter(x=>x.added&&x.platform==='cross').length,56);
 const scientificFiles=JSON.parse(readFileSync('scripts/scientific/test-inventory.json')).filter(file=>/scientific-(?:history-clocks|engine|http|boundary-regressions|runner|composition)\.test\.mjs$/.test(file));
 assert.equal(scientificFiles.length,6);
 for(const file of scientificFiles)assert.ok(inv.tests.some(x=>x.added&&x.platform==='cross'&&x.file===file&&x.destination===file));
 assert.equal(inv.tests.filter(x=>x.name==='strict parser rejects malformed or over-limit structured input').length,9);
 assert.doesNotThrow(()=>verifySourceProof());
 const proof=JSON.parse(readFileSync('scripts/platform-source-proof.json'));
 assert.throws(()=>verifySourceProof({...proof,testFiles:proof.testFiles.slice(1)}));
 assert.throws(()=>verifySourceProof(proof,{read:path=>Buffer.from('substituted assertion')}));
 assert.throws(()=>verifySourceProof({...proof,baselineCommit:'0'.repeat(40)}));
 const extra=mkdtempSync(join('tests','platform-extra-'));try{writeFileSync(join(extra,'hidden.test.mjs'),"throw Error('omitted source test');");assert.throws(()=>verifySourceProof());}finally{rmSync(extra,{recursive:true,force:true});}
 const changed=structuredClone(proof);changed.testFiles[0].blob='0'.repeat(40);assert.throws(()=>verifySourceProof(changed));
});
test('platform coverage rejects absent duplicate extra cells wrong pins runtimes and event hashes',()=>{
 const inv={tests:[identity,{...identity,file:'tests/windows.windows.mjs',name:'win',platform:'windows'},{...identity,file:'tests/cross.cross.mjs',name:'both',platform:'cross'}]};
 const context={head:'a'.repeat(40),tree:'b'.repeat(40),runId:'123',attempt:'1'};
 const cells=['linux-22-16','linux-22-18','linux-24-16','linux-24-18','windows-22','windows-24'];
 const receipts=cells.map(cell=>{const [platform,node,postgres]=cell.split('-');const events=inv.tests.filter(x=>x.platform===platform||x.platform==='cross').map(x=>({...x,status:'pass'}));const raw=events.map(x=>JSON.stringify({...x,type:'terminal'})).join('\n')+'\n'+JSON.stringify({type:'summary',success:true,counts:{tests:events.length,passed:events.length,failed:0,cancelled:0,skipped:0,todo:0}})+'\n';return{cell,platform:platform==='windows'?'win32':'linux',node,nodeVersion:node+'.0.0',postgresVersion:postgres?postgres+'.0':null,postgres:postgres??null,...context,inventorySha:sha256(JSON.stringify(inv)),sourceProofSha:'c'.repeat(64),eventsSha:sha256(raw),eventsRaw:raw,events:events.map(x=>({...x,type:'terminal'})),ok:true,summary:{tests:events.length,pass:events.length,fail:0,cancelled:0,skipped:0,todo:0}};});
 const options={inventory:inv,...context,sourceProofSha:'c'.repeat(64)};
 assert.equal(validateCoverage(receipts,options).uniqueTests,3);
 for(const bad of [receipts.slice(1),[...receipts,receipts[0]],[...receipts,{...receipts[0],cell:'extra'}]])assert.throws(()=>validateCoverage(bad,options));
 for(const counts of [{tests:2,passed:2,failed:1,cancelled:0,skipped:0,todo:0},{tests:99,passed:99,failed:0,cancelled:0,skipped:0,todo:0}]){const records=receipts[0].eventsRaw.trim().split('\n').map(x=>JSON.parse(x));records.at(-1).counts=counts;const eventsRaw=records.map(x=>JSON.stringify(x)).join('\n')+'\n';assert.throws(()=>validateCoverage([{...receipts[0],eventsRaw,eventsSha:sha256(eventsRaw)},...receipts.slice(1)],options));}
 for(const mutation of [{head:'d'.repeat(40)},{tree:'e'.repeat(40)},{runId:'2'},{attempt:'2'},{node:'20'},{nodeVersion:'v20.0.0'},{postgresVersion:'15.1'},{platform:'darwin'},{postgres:'15'},{eventsSha:'0'.repeat(64)},{sourceProofSha:'0'.repeat(64)},{inventorySha:'0'.repeat(64)},{ok:false},{summary:{tests:1,pass:1,skipped:1}}])assert.throws(()=>validateCoverage([{...receipts[0],...mutation},...receipts.slice(1)],options));
});
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseEventEvidence} from '../scripts/platform-coverage.mjs';
test('platform reporter captures actual repeated and nested terminals with final summary',()=>{
 const directory=mkdtempSync(join(tmpdir(),'platform-reporter-'));
 try{
  const file=join(directory,'fixture.test.mjs');writeFileSync(file,"import test from 'node:test';test('parent',async t=>{await t.test('child',()=>{});});for(let i=0;i<2;i++)test('repeat',()=>{});");
  const childEnv={...process.env};delete childEnv.NODE_TEST_CONTEXT;const result=spawnSync(process.execPath,['--test','--test-reporter=./scripts/platform-test-reporter.mjs',file],{env:childEnv,encoding:'utf8',timeout:15000,windowsHide:true});assert.equal(result.status,0,result.stderr);
  const records=result.stdout.trim().split(/\r?\n/).map(x=>JSON.parse(x));const terminals=records.filter(x=>x.type==='terminal');assert.equal(terminals.length,4);assert.equal(terminals.find(x=>x.name==='child').parent,'parent');assert.equal(terminals.filter(x=>x.name==='repeat').length,2);assert.equal(records.at(-1).type,'summary');
  const inventory={tests:terminals.map(x=>({file:x.file,destination:x.file}))};assert.equal(parseEventEvidence(result.stdout,inventory).summary.tests,4);
  for(const mutation of [records.slice(0,-1),[...records,records.at(-1)],[records.at(-1),...records.slice(0,-1)]])assert.throws(()=>parseEventEvidence(mutation.map(x=>JSON.stringify(x)).join('\n'),inventory));
 }finally{rmSync(directory,{recursive:true,force:true});}
});
