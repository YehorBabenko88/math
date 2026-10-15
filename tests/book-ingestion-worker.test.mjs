import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {intakePdf,extractPdfPage} from '../src/book-ingestion/pdf.mjs';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
import {createLocalCodexAdapter,createExternalCodexAdapter} from '../src/book-ingestion/codex.mjs';
import {enqueueBookPages,runBookJob} from '../src/book-ingestion/worker.mjs';
const TEXT='This synthetic mathematical fixture describes motion and must be treated only as untrusted source data.';
const parser={inspect:async()=>({pageCount:1}),extract:async()=>({text:TEXT,method:'text',regions:[],references:[],image:null})};
function candidate(task){const page=task.sourceData;return {schemaVersion:'knowledge-candidate/v1',source:page.source,locator:page.locator,extraction:{version:page.extractionVersion,textHash64hex:page.textHash,quality:page.quality},concepts:[{id:'speed',label:'Speed',definition:'Distance divided by elapsed time.'}],formulas:[{id:'velocity',symbols:[{name:'d',unit:'m'},{name:'t',unit:'s'}],outputUnit:'m/s',ast:{op:'divide',left:{op:'input',name:'d'},right:{op:'input',name:'t'}},assumptions:['Uniform motion'],examples:[{inputs:{d:20,t:2},expected:10,tolerance:1e-10}]}],claims:[{id:'motion',text:'A model for uniform motion.',conceptIds:['speed'],formulaIds:['velocity'],dependencies:[],contradictions:[],uncertainty:0.5,status:'untested'}],evidence:[],uncertainty:0.5}}
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'book-worker-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'source.pdf');await writeFile(path,'%PDF-1.4\nfixture');const book=await intakePdf({path,edition:'Test edition',version:'scan-1',license:'CC0 synthetic',scope:{pages:[1],allowLocalProcessing:true,allowExternalProcessing:false,allowExcerpts:false,maxExcerptChars:0},parser});const queue=await openBookQueue({directory:join(dir,'queue')});return {dir,book,queue}}
test('explicit worker creates a pinned reproducible candidate, metrics and import-once job',async t=>{
 const {book,queue,dir}=await setup(t);let calls=0;
 const adapter=createLocalCodexAdapter({extract:async task=>{calls++;assert.match(task.instructions,/untrusted/);assert.equal(task.responseSchema.properties.schemaVersion.const,'knowledge-candidate/v1');return candidate(task)}});
 const jobs=await enqueueBookPages(queue,book,{extractionVersion:'extract-1'});await enqueueBookPages(queue,book,{extractionVersion:'extract-1'});
 const result=await runBookJob({queue,parser,adapter,workerId:'test-worker'});assert.equal(result.state,'completed');
 const stored=await queue.get(jobs[0].id);assert.equal(stored.result.stage,'review_required');assert.equal(stored.result.report.status,'valid');assert.equal(stored.metrics.pagesAttempted,1);assert.equal(stored.metrics.aiSuggestions,3);assert.equal(calls,1);
 const reopened=await openBookQueue({directory:join(dir,'queue')});assert.equal(await runBookJob({queue:reopened,parser,adapter,workerId:'again'}),null);
 assert.equal((await reopened.get(jobs[0].id)).result.digest,stored.result.digest);
});
test('external adapter requires separate source/page authorization before any disclosure',async t=>{
 const {book,queue}=await setup(t);let calls=0;
 const adapter=createExternalCodexAdapter({transport:async()=>{calls++;throw Error('private text must not leak')},authorization:{sourceHash:book.hash,pages:[1],allowed:true},maxCalls:1,maxCostPerCall:0.1});
 await enqueueBookPages(queue,book,{extractionVersion:'1'});const result=await runBookJob({queue,parser,adapter,workerId:'test'});
 assert.equal(result.state,'failed');assert.equal(calls,0);assert.equal(JSON.stringify(result).includes('private text'),false);
});
test('malformed AI, copied excerpts and wrong source pins are rejected without raw-text logs',async t=>{
 for(const mutate of [p=>p.source.hash64hex='a'.repeat(64),p=>p.claims[0].status='proven',p=>p.claims[0].text=TEXT,p=>p.formulas[0].ast.op='eval']){
  const {book,queue}=await setup(t),adapter=createLocalCodexAdapter({extract:task=>{const p=structuredClone(candidate(task));mutate(p);return p}});await enqueueBookPages(queue,book,{extractionVersion:'1'});
  const result=await runBookJob({queue,parser,adapter,workerId:'test'});assert.equal(result.state,'failed');const record=(await queue.list())[0];assert.equal(record.errorCode,'INGESTION_REJECTED');assert.equal(JSON.stringify(record).includes(TEXT),false);
 }
});
test('authorized external JSON contract enforces request/cost budgets and preserves pins',async t=>{
 const {book,queue}=await setup(t),authorizedBook={...book,scope:{...book.scope,allowExternalProcessing:true}};let key;
 const adapter=createExternalCodexAdapter({authorization:{sourceHash:book.hash,pages:[1],allowed:true},maxCalls:1,maxCostPerCall:0.1,transport:async(task,options)=>{key=options.idempotencyKey;assert.match(task.sourceData.text,/untrusted source data/);return {json:JSON.stringify(candidate(task)),cost:0.02}}});
 await enqueueBookPages(queue,authorizedBook,{extractionVersion:'1'});const result=await runBookJob({queue,parser,adapter,workerId:'test'});
 assert.equal(result.state,'completed');assert.equal(result.metrics.cost,0.02);assert.match(key,/^[a-f0-9]{64}$/);
});
test('direct external API checks file identity and actual page scope before transport',async t=>{
 const {book}=await setup(t),page=await extractPdfPage(book,1,{parser,extractionVersion:'1'});let calls=0;
 for(const modified of [{...book,hash:'b'.repeat(64),scope:{...book.scope,allowExternalProcessing:true}},{...book,scope:{...book.scope,pages:[2],allowExternalProcessing:true}},{...book,scope:{...book.scope,allowLocalProcessing:false,allowExternalProcessing:true}}]){
  const adapter=createExternalCodexAdapter({authorization:{sourceHash:book.hash,pages:[1],allowed:true},transport:()=>{calls++;return {json:JSON.stringify(candidate({sourceData:page})),cost:0}}});
  await assert.rejects(adapter.extract(page,{book:modified}));
 }assert.equal(calls,0);
});
test('split verbatim excerpts and checkpoint resumption cannot bypass source policy',async t=>{
 const first=await setup(t),adapter=createLocalCodexAdapter({extract:task=>{const p=structuredClone(candidate(task));p.concepts=[{id:'a',label:'A',definition:TEXT.slice(0,39)},{id:'b',label:'B',definition:TEXT.slice(39,78)}];p.claims[0].conceptIds=['a','b'];return p}});
 await enqueueBookPages(first.queue,first.book,{extractionVersion:'1'});assert.equal((await runBookJob({queue:first.queue,parser,adapter,workerId:'test'})).state,'failed');
});
test('checkpoint recovery rechecks excerpt permission before completion',async t=>{
 const {book,queue}=await setup(t);const [job]=await enqueueBookPages(queue,book,{extractionVersion:'1'}),leased=await queue.acquire({workerId:'old',leaseMs:60000});
 const page=await extractPdfPage(book,1,{parser,extractionVersion:'1'}),p=candidate({sourceData:page});p.concepts[0].definition=TEXT;
 await queue.checkpoint(job.id,leased.token,{candidate:p,cost:0,metrics:{pagesAttempted:1,extractionFailures:0,aiSuggestions:3,reviewDecisions:0,cost:0}});await queue.fail(job.id,leased.token,{code:'INTERRUPTED',retryable:true});
 const result=await runBookJob({queue,parser,adapter:createLocalCodexAdapter({extract:()=>{throw Error('must not execute')}}),workerId:'new'});assert.equal(result.state,'failed');
});
test('paid rejected response still records transport-reported cost without source text',async t=>{
 const {book,queue}=await setup(t),authorizedBook={...book,scope:{...book.scope,allowExternalProcessing:true}};
 const adapter=createExternalCodexAdapter({authorization:{sourceHash:book.hash,pages:[1],allowed:true},maxCostPerCall:0.1,transport:()=>({json:'{"unsafe":"PRIVATE_TEXT"}',cost:0.03})});
 const [job]=await enqueueBookPages(queue,authorizedBook,{extractionVersion:'1'});await runBookJob({queue,parser,adapter,workerId:'test'});
 const record=await queue.get(job.id);assert.equal(record.state,'failed');assert.equal(record.checkpoint.metrics.cost,0.03);assert.equal(JSON.stringify(record).includes('PRIVATE_TEXT'),false);
});
test('interrupted after candidate checkpoint reuses verified suggestion on lease recovery',async t=>{
 const {book,queue,dir}=await setup(t);let calls=0;const adapter=createLocalCodexAdapter({extract:task=>{calls++;return candidate(task)}});
 await enqueueBookPages(queue,book,{extractionVersion:'1'});
 let once=true;const interrupted={...queue,complete:async(...args)=>{if(once){once=false;throw Error('crash at commit')}return queue.complete(...args)}};
 const attempt=await runBookJob({queue:interrupted,parser,adapter,workerId:'first'});assert.equal(attempt.state,'queued');
 const reopened=await openBookQueue({directory:join(dir,'queue')});const recovered=await runBookJob({queue:reopened,parser,adapter,workerId:'second'});assert.equal(recovered.state,'completed');assert.equal(calls,1);
});
