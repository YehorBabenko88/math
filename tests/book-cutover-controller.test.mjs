import test from 'node:test';
import assert from 'node:assert/strict';
test('controller cannot open production cutover or accept boolean authority',async()=>{
 const {openBookCutoverController}=await import('../src/book-ingestion/cutover-controller.mjs');
 assert.throws(()=>openBookCutoverController({mode:'production'}),/rehearsal/);
 assert.throws(()=>openBookCutoverController({mode:'rehearsal',verifier:true}),/configuration/);
});
import {mkdtempSync,realpathSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,generateKeyPairSync,sign} from 'node:crypto';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
import {createOperatorSessionVerifier,operatorSessionSigningBytes} from '../src/book-ingestion/operator-session.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
async function scenario(fn){await withIsolatedPostgres(url,async({pool})=>{
 const root=realpathSync(mkdtempSync(join(tmpdir(),'book-controller-')));try{
 const directory=join(root,'source'),backupRoot=join(root,'backup');const q=await openBookQueue({directory,now:()=>1000});await q.enqueue({sourceHash:'b'.repeat(64),edition:'synthetic',page:1,extractionVersion:'v1',payload:{}});await q.acquire({workerId:'old-worker',leaseMs:5000});await applyBookMigrations(pool);
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');const runId=randomUUID(),resourceId='a'.repeat(64);let time=1000;
 const verifier=createOperatorSessionVerifier({publicKey,issuer:'test',audience:'cutover',now:()=>time});
 const claims={version:'book-operator-session/v1',issuer:'test',audience:'cutover',subject:'operator',sessionId:'synthetic',issuedAt:1000,expiresAt:100000,runId,resourceId,scopes:['prepare','quiesce','backup','transfer','verify','activate']};
 const session={...claims,signature:sign(null,operatorSessionSigningBytes(claims),privateKey).toString('base64url')};
 const {openBookCutoverController}=await import('../src/book-ingestion/cutover-controller.mjs');
 const options={directory,backupRoot,pool,runId,resourceId,verifier,now:()=>time};
 const controller=openBookCutoverController(options);try{await fn({controller,options,session,pool,root,setTime:v=>time=v});}finally{controller.close();}
 }finally{rmSync(root,{recursive:true,force:true});}
});}
test('controller resumes explicit rehearsal, fences both writers and never opens production',{skip:!url},async()=>scenario(async({controller,options,session,pool})=>{
 assert.equal(controller.prepare({session}).state,'PREPARE');
 await assert.rejects(controller.advance({session:true}));
 const expected=['QUIESCE','BACKUP','TRANSFER','VERIFY','READY','ACTIVATED'];
 for(const state of expected){const next=await controller.advance({session});assert.equal(next.state,state);}
 const final=await controller.advance({session});assert.equal(final.evidence.activation.backendSwitched,false);assert.equal(final.evidence.readiness.productionReady,false);
 await assert.rejects(pool.query('DELETE FROM mu_book_jobs'),/fenced/);
 const {openBookCutoverController}=await import('../src/book-ingestion/cutover-controller.mjs');const reopened=openBookCutoverController(options);try{assert.equal(reopened.status().state,'ACTIVATED');}finally{reopened.close();}
}));
test('controller refuses modified backup after verify and keeps fences closed',{skip:!url},async()=>scenario(async({controller,options,session,pool})=>{
 controller.prepare({session});for(let i=0;i<5;i++)await controller.advance({session});
 const path=join(options.backupRoot,options.runId,'queue.sqlite');const bytes=readFileSync(path);bytes[100]^=1;writeFileSync(path,bytes);
 await assert.rejects(controller.advance({session}),/failed closed/);assert.equal(controller.status().state,'FAILED');await assert.rejects(pool.query('DELETE FROM mu_book_jobs'),/fenced/);
}));

test('controller rechecks scope after a concurrent state transition',{skip:!url},async()=>scenario(async({controller,options,session})=>{
 controller.prepare({session});const {openCutoverJournal}=await import('../src/book-ingestion/cutover-journal.mjs');
 const status=controller.status();const other=openCutoverJournal({directory:options.directory,runId:options.runId,configHash:status.configHash,now:options.now});let moved=false,backupScopeChecked=false;
 const verifier={verify(s,context){if(context.scope==='backup'){backupScopeChecked=true;throw Error('scope denied');}const proof=options.verifier.verify(s,context);if(context.scope==='quiesce'&&!moved){moved=true;const c=other.claim(proof);other.commit(c,'QUIESCE',{},proof);}return proof;}};
 const {openBookCutoverController}=await import('../src/book-ingestion/cutover-controller.mjs');const racing=openBookCutoverController({...options,verifier});
 try{await assert.rejects(racing.advance({session}),/failed closed/);assert.equal(racing.status().state,'FAILED');assert.equal(backupScopeChecked,true);}finally{racing.close();other.close();}
}));


test('concurrent controllers cannot both advance one state',{skip:!url},async()=>scenario(async({controller,options,session})=>{
 controller.prepare({session});const {openBookCutoverController}=await import('../src/book-ingestion/cutover-controller.mjs');const other=openBookCutoverController(options);
 try{const results=await Promise.allSettled([controller.advance({session}),other.advance({session})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(controller.status().state,'QUIESCE');}finally{other.close();}
}));
test('target fencing rotation after verify prevents activation',{skip:!url},async()=>scenario(async({controller,options,session,pool})=>{
 controller.prepare({session});for(let i=0;i<5;i++)await controller.advance({session});
 const {fenceBookPostgres}=await import('../src/book-ingestion/cutover-postgres.mjs');const status=controller.status();
 await fenceBookPostgres({pool,runId:options.runId,sourceId:status.evidence.source.sourceId,generation:status.generation+10});
 await assert.rejects(controller.advance({session}),/failed closed/);assert.equal(controller.status().state,'FAILED');
}));
test('expired operator session cannot publish asynchronous effects',{skip:!url},async()=>scenario(async({controller,options,session,pool,setTime})=>{
 controller.prepare({session});const {openBookCutoverController}=await import('../src/book-ingestion/cutover-controller.mjs');
 const delayedPool={async connect(){const client=await pool.connect();setTime(100001);return client;}};
 const restarted=openBookCutoverController({...options,pool:delayedPool});
 try{await assert.rejects(restarted.advance({session}),/failed closed/);assert.equal(restarted.status().state,'PREPARE');await assert.rejects(pool.query('DELETE FROM mu_book_jobs'),/fenced/);}finally{restarted.close();}
}));
test('restart between steps reuses durable evidence without opening writers',{skip:!url},async()=>scenario(async({controller,options,session})=>{
 controller.prepare({session});const {openBookCutoverController}=await import('../src/book-ingestion/cutover-controller.mjs');
 for(const state of ['QUIESCE','BACKUP','TRANSFER','VERIFY','READY']){const restarted=openBookCutoverController(options);try{assert.equal((await restarted.advance({session})).state,state);}finally{restarted.close();}}
 assert.equal(controller.status().evidence.readiness.productionReady,false);
}));
test('source snapshot tampering after verify blocks simulated activation',{skip:!url},async()=>scenario(async({controller,options,session})=>{
 controller.prepare({session});for(let i=0;i<5;i++)await controller.advance({session});
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(join(options.directory,'queue.sqlite'));
 try{db.exec('DROP TRIGGER book_cutover_jobs_update');db.exec('UPDATE jobs SET updatedAt=updatedAt+1');}finally{db.close();}
 await assert.rejects(controller.advance({session}),/failed closed/);assert.equal(controller.status().state,'FAILED');
}));
