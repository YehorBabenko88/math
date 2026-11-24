import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {intakePdf,extractPdfPage} from '../src/book-ingestion/pdf.mjs';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
import {enqueueBookPages,runBookJob} from '../src/book-ingestion/worker.mjs';
import {createExternalCodexAdapter} from '../src/book-ingestion/codex.mjs';
import {hashCandidate} from '../src/book-ingestion/candidate.mjs';
import {buildReviewedGraphPatch} from '../src/book-ingestion/graph-adapter.mjs';
import {createReviewDecision} from '../src/book-ingestion/review.mjs';

const TEXT='Synthetic source context for a numerical relation, with no third party content or executable instructions.';
const parser={inspect:async()=>({pageCount:1}),extract:async()=>({text:TEXT,method:'text',regions:[],references:[],image:null})};
function proposal(page){return {schemaVersion:'knowledge-candidate/v1',source:structuredClone(page.source),locator:structuredClone(page.locator),extraction:{version:page.extractionVersion,textHash64hex:page.textHash,quality:structuredClone(page.quality)},concepts:[{id:'distance',label:'Distance',definition:'Length measured in metres.'}],formulas:[{id:'distance-model',symbols:[{name:'v',unit:'m/s'},{name:'t',unit:'s'}],outputUnit:'m',ast:{op:'multiply',left:{op:'input',name:'v'},right:{op:'input',name:'t'}},assumptions:['Constant speed'],examples:[{inputs:{v:2,t:3},expected:6,tolerance:0}]}],claims:[{id:'model',text:'Constant speed gives a displacement model.',formulaIds:['distance-model'],conceptIds:['distance'],dependencies:[],contradictions:[],uncertainty:0.5,status:'untested'}],evidence:[],uncertainty:0.5};}
async function setup(t,{external=false}={}){
 const directory=await mkdtemp(join(tmpdir(),'book-policy-integration-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const path=join(directory,'synthetic.pdf');await writeFile(path,'%PDF-1.4\nsynthetic trusted-parser fixture\n%%EOF');
 const book=await intakePdf({path,edition:'Synthetic first edition',version:'source-v1',license:'CC0 synthetic',scope:{pages:[1],allowLocalProcessing:true,allowExternalProcessing:external,allowExcerpts:false,maxExcerptChars:0},parser});
 const queue=await openBookQueue({directory:join(directory,'initial')});const [job]=await enqueueBookPages(queue,book,{extractionVersion:'extract-policy-v1',locatorOverrides:{1:{printedPage:'i',region:null}}});
 const page=await extractPdfPage(book,1,{parser,extractionVersion:job.extractionVersion,printedPage:'i'});
 return {directory,book,queue,job,page};
}
async function restoreCheckpoint(t,fixture,candidate){
 const lease=await fixture.queue.acquire({workerId:'interrupted-worker',leaseMs:60000});
 await fixture.queue.checkpoint(fixture.job.id,lease.token,{candidate,cost:0,metrics:{pagesAttempted:1,extractionFailures:0,aiSuggestions:3,reviewDecisions:0,cost:0}});
 const snapshot=await fixture.queue.exportSnapshot();
 const restored=await openBookQueue({directory:join(fixture.directory,'restored')});await restored.importSnapshot(JSON.stringify(snapshot));
 const saved=await restored.get(fixture.job.id);assert.equal(saved.state,'queued');assert.equal(saved.token,undefined);assert.deepEqual(saved.checkpoint.candidate,candidate);assert.deepEqual(saved.payload,fixture.job.payload);
 await assert.rejects(restored.complete(fixture.job.id,lease.token,{result:{},metrics:{}}),/Lease rejected/);
 return openBookQueue({directory:join(fixture.directory,'restored')});
}

test('real SQLite checkpoint restore resumes exact source pins and still requires explicit human review',async t=>{
 const f=await setup(t),candidate=proposal(f.page),queue=await restoreCheckpoint(t,f,candidate);let adapterCalls=0;
 const result=await runBookJob({queue,parser,adapter:{extract:async()=>{adapterCalls++;throw Error('checkpoint should be reused')}},workerId:'resumed-worker',jobId:f.job.id});
 assert.equal(result.state,'completed');assert.equal(adapterCalls,0);assert.equal(result.result.stage,'review_required');assert.equal(result.result.digest,hashCandidate(candidate));assert.deepEqual(result.result.candidate,candidate);assert.equal(result.metrics.reviewDecisions,0);assert.equal(result.result.reviewReceipt,undefined);
 assert.throws(()=>buildReviewedGraphPatch(result.result.candidate,result.result.reviewReceipt));
 const receipt=createReviewDecision(candidate,{decision:'approved',reviewer:'synthetic reviewer',reason:'Checked the synthetic source and benchmark',reviewedAt:'2026-10-16T10:00:00.000Z',visualVerified:false});
 const patch=buildReviewedGraphPatch(candidate,receipt);assert.ok(patch.nodes.filter(n=>['Claim','Formula'].includes(n.type)).every(n=>n.status==='untested'));
 const pin=JSON.parse(patch.nodes[0].provenance.locator);assert.deepEqual(pin.source,candidate.source);assert.deepEqual(pin.locator,candidate.locator);
 assert.equal((await queue.get(f.job.id)).result.reviewReceipt,undefined);
});

test('restored candidate source version locator text and quality tampering fails before adapter or review',async t=>{
 for(const [name,mutate] of Object.entries({source:p=>p.source.hash64hex='a'.repeat(64),version:p=>p.source.version='source-v2',license:p=>p.source.license='different',locator:p=>p.locator.printedPage='ii',extraction:p=>p.extraction.version='other',text:p=>p.extraction.textHash64hex='b'.repeat(64),quality:p=>p.extraction.quality.score=0.9,status:p=>p.claims[0].status='proven'}))await t.test(name,async t=>{
  const f=await setup(t),candidate=proposal(f.page);mutate(candidate);const queue=await restoreCheckpoint(t,f,candidate);let calls=0;
  const result=await runBookJob({queue,parser,adapter:{extract:async()=>{calls++;throw Error('must not run')}},workerId:'resumed-worker',jobId:f.job.id});
  assert.equal(result.state,'failed');assert.equal(calls,0);const stored=await queue.get(f.job.id);assert.equal(stored.result,undefined);assert.equal(stored.errorCode,'INGESTION_REJECTED');assert.throws(()=>buildReviewedGraphPatch(candidate,undefined));
 });
});

test('restored real Book jobs never call external transport without both scope and source-page consent',async t=>{
 for(const mode of ['scope-denied','no-consent','wrong-source','wrong-page'])await t.test(mode,async t=>{
  const f=await setup(t,{external:mode!=='scope-denied'}),lease=await f.queue.acquire({workerId:'interrupted-worker',leaseMs:60000});
  await f.queue.checkpoint(f.job.id,lease.token,{metrics:{pagesAttempted:0,cost:0}});const snapshot=await f.queue.exportSnapshot();const queue=await openBookQueue({directory:join(f.directory,'restored')});await queue.importSnapshot(snapshot);
  let calls=0;const authorization=mode==='no-consent'?undefined:{allowed:true,sourceHash:mode==='wrong-source'?'a'.repeat(64):f.book.hash,pages:mode==='wrong-page'?[2]:[1]};
  const adapter=createExternalCodexAdapter({authorization,transport:async()=>{calls++;throw Error('unauthorized transport')}});
  const result=await runBookJob({queue,parser,adapter,workerId:'resumed-worker',jobId:f.job.id});
  assert.equal(result.state,'failed');assert.equal(calls,0);assert.equal((await queue.get(f.job.id)).result,undefined);
 });
});
