import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
import {openPostgresBookQueue} from '../src/book-ingestion/postgres-queue.mjs';
import {planBookTransfer,applyBookTransfer,verifyBookTransfer,rollbackBookTransfer} from '../src/book-ingestion/postgres-transfer.mjs';
import {assessBookPostgresGate} from '../src/book-ingestion/postgres-gate.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
function source(){const sourceHash='a'.repeat(64);return {schemaVersion:1,maxAttempts:3,jobs:[{id:createHash('sha256').update(JSON.stringify([sourceHash,'test',1,'v1'])).digest('hex'),sourceHash,edition:'test',page:1,extractionVersion:'v1',payload:{},state:'leased',attempts:1,token:'b'.repeat(64),leaseUntil:9000,workerId:'old',createdAt:1,updatedAt:2}]};}
const live=(name,fn)=>test(name,{skip:!url},()=>withIsolatedPostgres(url,async({pool})=>{await applyBookMigrations(pool);await fn(pool)}));
live('atomic transfer restarts, invalidates leases and requires quiescent source confirmation',async pool=>{
 const snapshot=source(),expectedHash=planBookTransfer({snapshot}).snapshotHash,opts={pool,snapshot,expectedHash,now:()=>100};
 assert.equal((await applyBookTransfer(opts)).repeated,false);assert.equal((await applyBookTransfer(opts)).repeated,true);
 const evidence=await verifyBookTransfer({pool,snapshotHash:expectedHash});assert.equal(evidence.verified,true);
 const q=await openPostgresBookQueue({pool,now:()=>100});assert.equal((await q.get(snapshot.jobs[0].id)).errorCode,'RESTORED_LEASE');await assert.rejects(q.complete(snapshot.jobs[0].id,snapshot.jobs[0].token,{result:{},metrics:{}}),/Lease rejected/);
 assert.equal((await assessBookPostgresGate({pool,snapshotHash:expectedHash})).compatible,false);
 const operatorConfirmation=`SOURCE SQLITE QUIESCED; ACTIVATE BOOK POSTGRES ${expectedHash} ${evidence.targetHash} ${evidence.targetHeadHash}`;
 const gate=await assessBookPostgresGate({pool,snapshotHash:expectedHash,operatorConfirmation});assert.equal(gate.compatible,false);assert.ok(gate.blockers.includes('native-json-text-parity'));
 // Exercise the rollback safety check independently; production activation is blocked.
 await pool.query("UPDATE mu_book_imports SET manifest=jsonb_set(manifest,'{activated}','true') WHERE snapshot_hash=$1",[expectedHash]);
 await assert.rejects(rollbackBookTransfer({pool,snapshotHash:expectedHash}),/activated/);
});
live('SQL failure rolls back ledger and rows, retry succeeds; changed imported row blocks rollback',async pool=>{
 const snapshot=source();const next=structuredClone(snapshot.jobs[0]);next.page=2;next.id=createHash('sha256').update(JSON.stringify([next.sourceHash,next.edition,2,next.extractionVersion])).digest('hex');snapshot.jobs.push(next);
 const expectedHash=planBookTransfer({snapshot}).snapshotHash;
 await pool.query("CREATE FUNCTION reject_book() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (NEW.document->>'page')::int=2 THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$");await pool.query('CREATE TRIGGER reject_book BEFORE INSERT ON mu_book_jobs FOR EACH ROW EXECUTE FUNCTION reject_book()');
 await assert.rejects(applyBookTransfer({pool,snapshot,expectedHash}),/synthetic failure/);assert.equal((await pool.query('SELECT * FROM mu_book_imports')).rowCount,0);assert.equal((await pool.query('SELECT * FROM mu_book_jobs')).rowCount,0);
 await pool.query('DROP TRIGGER reject_book ON mu_book_jobs');await applyBookTransfer({pool,snapshot,expectedHash});
 const evidence=await verifyBookTransfer({pool,snapshotHash:expectedHash});const oldConfirmation=`SOURCE SQLITE QUIESCED; ACTIVATE BOOK POSTGRES ${expectedHash} ${evidence.targetHash} ${evidence.targetHeadHash}`;
 const q=await openPostgresBookQueue({pool,now:()=>100});await q.acquire({workerId:'new',leaseMs:100});assert.equal((await verifyBookTransfer({pool,snapshotHash:expectedHash})).verified,false);assert.equal((await assessBookPostgresGate({pool,snapshotHash:expectedHash,operatorConfirmation:oldConfirmation})).compatible,false);await assert.rejects(rollbackBookTransfer({pool,snapshotHash:expectedHash}),/changed/);
});
live('rollback removes only imported rows and preserves unrelated work',async pool=>{
 const snapshot=source(),expectedHash=planBookTransfer({snapshot}).snapshotHash;await applyBookTransfer({pool,snapshot,expectedHash});const q=await openPostgresBookQueue({pool,now:()=>100});await q.enqueue({sourceHash:'c'.repeat(64),edition:'other',page:1,extractionVersion:'v1',payload:{}});
 assert.equal((await rollbackBookTransfer({pool,snapshotHash:expectedHash})).removedCount,1);assert.equal((await q.list()).length,1);assert.equal((await rollbackBookTransfer({pool,snapshotHash:expectedHash})).repeated,true);assert.equal((await applyBookTransfer({pool,snapshot,expectedHash})).repeated,false);assert.equal((await verifyBookTransfer({pool,snapshotHash:expectedHash})).verified,true);
});
live('digest pinned review receipt survives migration without promotion',async pool=>{
 const snapshot=source(),j=snapshot.jobs[0];delete j.token;delete j.workerId;delete j.leaseUntil;j.state='completed';j.result={digest:'d'.repeat(64),stage:'review_required',reviewReceipt:{candidateDigest:'d'.repeat(64),decision:'approved',reviewer:'synthetic operator',reason:'synthetic review',reviewedAt:'2026-10-16T10:00:00.000Z',visualVerified:false}};j.metrics={reviewDecisions:1};
 const expectedHash=planBookTransfer({snapshot}).snapshotHash;await applyBookTransfer({pool,snapshot,expectedHash});const q=await openPostgresBookQueue({pool});const saved=await q.get(j.id);assert.deepEqual(saved.result,j.result);assert.equal(saved.result.stage,'review_required');assert.equal((await pool.query('SELECT * FROM mu_book_reviews')).rowCount,1);await q.recordReview(j.id,j.result.reviewReceipt);assert.equal((await q.get(j.id)).metrics.reviewDecisions,1);
});
