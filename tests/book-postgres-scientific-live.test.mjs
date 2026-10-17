import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {verifyCandidate} from '../src/book-ingestion/candidate.mjs';
import {createReviewDecision} from '../src/book-ingestion/review.mjs';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
import {openPostgresBookQueue} from '../src/book-ingestion/postgres-queue.mjs';
import {planBookTransfer,applyBookTransfer} from '../src/book-ingestion/postgres-transfer.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
test('scientific candidate pins, dimensions, numeric evidence and human receipt survive transfer without proof promotion',{skip:!url},async()=>{
 const sourceHash='a'.repeat(64),edition='synthetic',page=1,extractionVersion='synthetic-parser-1';
 const candidate={schemaVersion:'knowledge-candidate/v1',source:{hash64hex:sourceHash,edition,version:'scan-1',license:'CC0 synthetic'},locator:{pdfPage1based:1,printedPage:'i',region:null},extraction:{version:extractionVersion,quality:{score:1,method:'text',needsVisualReview:false},textHash64hex:'b'.repeat(64)},concepts:[],formulas:[{id:'speed',symbols:[{name:'d',unit:'m'},{name:'t',unit:'s'}],outputUnit:'m/s',ast:{op:'divide',left:{op:'input',name:'d'},right:{op:'input',name:'t'}},assumptions:['uniform motion'],examples:[{inputs:{d:20,t:2},expected:10,tolerance:0}]}],claims:[{id:'speedLaw',text:'Synthetic speed relation',formulaIds:['speed'],conceptIds:[],dependencies:[],contradictions:[],uncertainty:0.2,status:'untested'}],evidence:[],uncertainty:0.2};
 const verified=verifyCandidate(candidate),reviewReceipt=createReviewDecision(candidate,{decision:'approved',reviewer:'Synthetic reviewer',reason:'Synthetic dimensional and numerical check',reviewedAt:'2026-10-17T00:00:00.000Z',visualVerified:false});
 const id=createHash('sha256').update(JSON.stringify([sourceHash,edition,page,extractionVersion])).digest('hex');
 const job={id,sourceHash,edition,page,extractionVersion,payload:{book:{hash:sourceHash,edition,version:'scan-1',license:'CC0 synthetic',pageCount:1,scope:{pages:[1],allowLocalProcessing:true,allowExternalProcessing:false,allowExcerpts:true,maxExcerptChars:2000}},render:false,locator:{printedPage:'i',region:null}},state:'completed',attempts:1,createdAt:1,updatedAt:2,result:{stage:'review_required',...verified,reviewReceipt},metrics:{reviewDecisions:1,cost:0}};
 const snapshot={schemaVersion:1,maxAttempts:3,jobs:[job]},plan=planBookTransfer({snapshot});
 const forged=structuredClone(snapshot);forged.jobs[0].result.candidate.claims[0].status='proven';assert.throws(()=>planBookTransfer({snapshot:forged}),/untested/);
 const changed=structuredClone(snapshot);changed.jobs[0].payload.book.version='other';assert.throws(()=>planBookTransfer({snapshot:changed}),/provenance/);
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);await applyBookTransfer({pool,snapshot,expectedHash:plan.snapshotHash});
  const queue=await openPostgresBookQueue({pool});const saved=await queue.get(id);
  assert.deepEqual(saved,job);assert.equal(saved.result.candidate.claims[0].status,'untested');assert.equal(saved.result.report.dimensionChecked,true);assert.equal(saved.result.report.examples[0].actual,10);assert.equal(saved.payload.book.scope.allowExternalProcessing,false);
 });
});
