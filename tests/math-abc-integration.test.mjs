import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {applyMathMigrations} from '../src/postgres-migrations.mjs';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
import {assessBookPostgresGate} from '../src/book-ingestion/postgres-gate.mjs';
import {openBookCutoverController} from '../src/book-ingestion/cutover-controller.mjs';
import {enableFencedIngestionService} from '../src/ingestion-service.mjs';
import {createIngestionJobStore} from '../src/ingestion-job-postgres.mjs';
import {createFencedIngestionJobStore} from '../src/ingestion-job-postgres-fenced.mjs';
import {createScientificExperimentGraph} from '../src/experiment-graph.mjs';
import {validateGraphNodeEvidence} from '../src/graph-evidence-validation.mjs';
import {createKnowledgeAdapterRegistry} from '../src/knowledge-adapter-registry.mjs';
import {proposeKnowledgeAdapter} from '../src/knowledge-adapter-planner.mjs';
import {createPostgresAdapterSnapshotStore} from '../src/knowledge-adapter-postgres.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const live=(name,fn)=>test(name,{skip:!url},()=>withIsolatedPostgres(url,fn));

test('ABC integration: plaintext or boolean approval cannot open Book production gate',async()=>{
 let queries=0;const pool={query(){queries++;throw Error('must not query')},connect(){queries++;throw Error('must not connect')}};
 for(const operatorConfirmation of [true,'approved','SOURCE SQLITE QUIESCED']){
  const gate=await assessBookPostgresGate({pool,snapshotHash:'a'.repeat(64),operatorConfirmation});
  assert.equal(gate.compatible,false);assert.ok(gate.blockers.includes('operator-cutover-prerequisites'));
 }
 assert.throws(()=>openBookCutoverController({mode:'production',pool}),/production gate closed/);
 assert.equal(queries,0);
});

live('ABC integration: generic and Book ledgers coexist and independently reject source drift',async({pool})=>{
 await applyMathMigrations(pool);await applyBookMigrations(pool);
 assert.deepEqual(await applyMathMigrations(pool),[]);assert.deepEqual(await applyBookMigrations(pool),[]);
 for(const [apply,directory] of [[applyMathMigrations,'../sql/'],[applyBookMigrations,'../sql/book/']]){
  await assert.rejects(apply(pool,{readSql:async name=>Buffer.concat([await readFile(new URL(directory+name,import.meta.url)),Buffer.from('\n-- synthetic drift')])}),/MIGRATION_CONTENT_CHANGED/);
 }
 assert.deepEqual(await applyMathMigrations(pool),[]);assert.deepEqual(await applyBookMigrations(pool),[]);
 assert.equal((await pool.query('SELECT mu_ingestion_protocol_status() AS mode')).rows[0].mode,'legacy');
});

live('ABC integration: citation examples survive registry JSONB and fenced jobs without scientific promotion',async({pool})=>{
 await applyMathMigrations(pool);await applyBookMigrations(pool);
 const graph=createScientificExperimentGraph();graph.addSource('unrelated','time-series',[999,999]);
 const association=validateGraphNodeEvidence(graph,'unrelated',{claim:'synthetic independent example',referenceId:'synthetic',locator:'page 1',observations:[{expected:1,actual:1,expectedUnit:'m/s',actualUnit:'m/s'}]});
 const registry=createKnowledgeAdapterRegistry();
 const proposal=structuredClone(proposeKnowledgeAdapter({from:{id:'a',referenceId:'synthetic',locator:'p1'},to:{id:'b',referenceId:'synthetic',locator:'p2'},relation:'equivalent-concept'}));
 proposal.notes={association,'ключ\u0000':'\u0000\ud800\udfff'};
 const original=registry.propose(proposal);registry.validate(original.id,{passed:true,checks:['numeric examples only']});
 assert.throws(()=>registry.review(original.id,{approved:true,reviewer:'synthetic',reason:'numeric reproduction only'}),/unresolved validation blockers/);
 const snapshots=createPostgresAdapterSnapshotStore(pool);await snapshots.save(registry);
 const restored=await snapshots.latest();assert.equal(restored.exportJSON(),registry.exportJSON());
 const record=restored.list()[0];assert.equal(record.id,original.id);assert.equal(record.state,'validated');assert.equal(record.review,null);
 const producer=createIngestionJobStore(pool);await producer.enqueue({kind:'verify-candidate',sourceHash:'synthetic',locator:'p1'});
 await enableFencedIngestionService(pool);const store=createFencedIngestionJobStore(pool);
 const old=await store.claim({workerId:'same-worker'});
 const client=await pool.connect();try{
  await client.query('BEGIN');await client.query("SELECT set_config('math_universe.claim_token',$1,true)",[old.claim_token]);
  await client.query("UPDATE mu_ingestion_jobs SET lease_until=now()-interval '1 second' WHERE job_id=$1",[old.job_id]);await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
 const fresh=await store.claim({workerId:'same-worker'});assert.notEqual(fresh.claim_token,old.claim_token);
 await assert.rejects(store.complete({jobId:old.job_id,workerId:'same-worker',claimToken:old.claim_token,result:{status:'proven'}}),{code:'JOB_LEASE_LOST'});
 await assert.rejects(producer.complete({jobId:fresh.job_id,workerId:'same-worker'}),/protocol|fenced/i);
 await store.complete({jobId:fresh.job_id,workerId:'same-worker',claimToken:fresh.claim_token,result:record.proposal.notes.association});
 const result=(await pool.query('SELECT result FROM mu_ingestion_jobs WHERE job_id=$1',[fresh.job_id])).rows[0].result;
 assert.equal(result.citationExamples.status,'reproduced');assert.equal(result.nodeOutputValidated,false);
 assert.equal(Object.hasOwn(result,'status'),false);assert.equal(Object.hasOwn(result,'evidence'),false);
 assert.equal((await assessBookPostgresGate({pool,snapshotHash:'a'.repeat(64),operatorConfirmation:true})).compatible,false);
});
