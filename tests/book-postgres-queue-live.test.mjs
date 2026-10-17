import test from 'node:test';
import assert from 'node:assert/strict';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {openPostgresBookQueue,transactionBookSnapshot} from '../src/book-ingestion/postgres-queue.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const source={sourceHash:'a'.repeat(64),edition:'native',page:1,extractionVersion:'v1',payload:{raw:'a=b',provenance:{page:1}}};
test('real Book queue: fencing, exhaustion, dedup, review, restore and rollback',{skip:!url},async()=>{
 const {applyBookMigrations}=await import('../src/book-ingestion/postgres-migrations.mjs');
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);let time=1000;
  const q=await openPostgresBookQueue({pool,now:()=>time,maxAttempts:2});
  const job=await q.enqueue(source);assert.deepEqual(await q.enqueue(source),job);
  const identity=await q.identityMap();assert.match(identity[0].postgresId,/^[1-9]\d*$/);
  const a=await q.acquire({workerId:'first',leaseMs:10});time=1010;
  const b=await q.acquire({workerId:'second',leaseMs:10});assert.equal(b.attempts,2);
  for(const operation of [()=>q.renew(a.id,a.token,{leaseMs:100}),()=>q.checkpoint(a.id,a.token,{}),()=>q.complete(a.id,a.token,{result:{},metrics:{}}),()=>q.fail(a.id,a.token,{code:'STALE'})])await assert.rejects(operation,/Lease rejected/);
  await q.fail(b.id,b.token,{code:'RETRY',retryable:true});assert.equal((await q.get(job.id)).state,'failed');
  const second=await q.enqueue({...source,page:2});const lease=await q.acquire({workerId:'review',leaseMs:50});
  const digest='b'.repeat(64);await q.complete(second.id,lease.token,{result:{digest,raw:'unaltered'},metrics:{items:1}});
  const receipt={candidateDigest:digest,decision:'rejected',reviewer:'human',reason:'check',reviewedAt:'2026-10-16T00:00:00.000Z',visualVerified:false};
  await q.recordReview(second.id,receipt);assert.deepEqual((await q.get(second.id)).result.reviewReceipt,receipt);
  const review=await pool.query('SELECT candidate_digest,receipt FROM mu_book_reviews');assert.equal(review.rows[0].candidate_digest,digest);
  assert.equal((await q.identityMap())[0].postgresId,identity[0].postgresId);
  const before=await q.exportSnapshot();
  await assert.rejects(transactionBookSnapshot(pool,{maxAttempts:2,now:()=>time},async(d,t,c)=>{d.jobs=[];await c.query('SELECT definitely_missing_book_column');}),/does not exist/);
  assert.deepEqual(await q.exportSnapshot(),before);
  await transactionBookSnapshot(pool,{maxAttempts:2,now:()=>time},d=>{d.jobs=[]});
  const corrupt=structuredClone(before);corrupt.jobs[0].id='0'.repeat(64);await assert.rejects(q.importSnapshot(corrupt));assert.deepEqual(await q.list(),[]);
  const leasedSnapshot=structuredClone(before);const restored=leasedSnapshot.jobs[0];Object.assign(restored,{state:'leased',attempts:1,token:'c'.repeat(64),workerId:'old',leaseUntil:2000});delete restored.errorCode;
  await q.importSnapshot(leasedSnapshot);assert.equal((await q.get(restored.id)).errorCode,'RESTORED_LEASE');
  await assert.rejects(q.checkpoint(restored.id,restored.token,{}),/Lease rejected/);
 });
});

test('real Book queue: concurrent claims, open recovery and ordinal compaction retain identities',{skip:!url},async()=>{
 const {applyBookMigrations}=await import('../src/book-ingestion/postgres-migrations.mjs');
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);let time=1000;
  const q=await openPostgresBookQueue({pool,now:()=>time});
  const first=await q.enqueue(source);
  const claims=await Promise.all(['a','b'].map(workerId=>q.acquire({workerId,leaseMs:10})));
  assert.equal(claims.filter(Boolean).length,1);
  time=1010;const reopened=await openPostgresBookQueue({pool,now:()=>time});
  assert.equal((await reopened.get(first.id)).state,'queued');
  const second=await q.enqueue({...source,page:2});const third=await q.enqueue({...source,page:3});
  const identities=await q.identityMap();
  await transactionBookSnapshot(pool,{maxAttempts:3,now:()=>time},d=>{d.jobs=d.jobs.filter(j=>j.id!==second.id)});
  assert.deepEqual((await q.list()).map(j=>j.id),[first.id,third.id]);
  assert.deepEqual(await q.identityMap(),identities.filter(i=>i.sqliteId!==second.id));
  await assert.rejects(q.complete(first.id,claims.find(Boolean).token,{result:{},metrics:{}}),/Lease rejected/);
 });
});
