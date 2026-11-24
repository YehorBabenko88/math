import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
import {openPostgresBookQueue,transactionBookSnapshot} from '../src/book-ingestion/postgres-queue.mjs';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
import {encodeBookJSON} from '../src/book-ingestion/postgres-codec.mjs';
import {planBookTransfer,applyBookTransfer,verifyBookTransfer,rollbackBookTransfer} from '../src/book-ingestion/postgres-transfer.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
const input=()=>({sourceHash:'a'.repeat(64),edition:'edition\0\ud800',page:1,extractionVersion:'parser\udfff',payload:{['key\0\ud800']:{values:['\0','\ud800','\udfff','😀','é','e\u0301'],envelope:encodeBookJSON({x:'ordinary nested envelope'})}}});

test('lossless wire preserves native UTF16 keys/values and snapshot SHA through complete/review/checkpoint',{skip:!url},async t=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'book-wire-')));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);const sqlite=await openBookQueue({directory,now:()=>100}),postgres=await openPostgresBookQueue({pool,now:()=>100});
  const receipt={candidateDigest:'c'.repeat(64),decision:'approved',reviewer:'reviewer\ud800',reason:'reason\udfff',reviewedAt:'2026-10-17T00:00:00.000Z',visualVerified:false};
  for(const queue of [sqlite,postgres]){
   const job=await queue.enqueue(input()),lease=await queue.acquire({workerId:'worker\0\udfff',leaseMs:1000});
   await queue.checkpoint(job.id,lease.token,{['\0checkpoint']:input().payload});
   await queue.renew(job.id,lease.token,{leaseMs:2000});
   await queue.complete(job.id,lease.token,{result:{digest:receipt.candidateDigest,raw:input().payload},metrics:{cost:1.5,max:Number.MAX_VALUE,min:Number.MIN_VALUE}});
   await queue.recordReview(job.id,receipt);
  }
  const source=await sqlite.exportSnapshot(),target=await postgres.exportSnapshot();
  assert.deepEqual(target,source);assert.equal(hash(ordered(target)),hash(ordered(source)));
  for(const field of ['payload','checkpoint','result','metrics'])assert.equal(JSON.stringify(target.jobs[0][field]),JSON.stringify(source.jobs[0][field]));
  const stored=(await pool.query('SELECT document_wire FROM mu_book_jobs')).rows[0].document_wire;
  assert.deepEqual(stored,encodeBookJSON(target.jobs[0]));
  assert.deepEqual((await postgres.identityMap())[0].sqliteId,source.jobs[0].id);
 });
});

test('lossless transfer invalidates old tokens, repeats and rolls back without changing source hash',{skip:!url},async t=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'book-wire-transfer-')));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const source=await openBookQueue({directory,now:()=>100}),job=await source.enqueue(input());
 const lease=await source.acquire({workerId:'source\ud800',leaseMs:1000});await source.checkpoint(job.id,lease.token,{raw:input().payload});
 const snapshot=await source.exportSnapshot(),before=hash(snapshot),plan=planBookTransfer({snapshot});assert.deepEqual(plan.unsupportedIds,[]);
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);const opts={pool,snapshot,expectedHash:plan.snapshotHash,now:()=>100};
  await applyBookTransfer(opts);assert.equal((await applyBookTransfer(opts)).repeated,true);
  assert.equal((await verifyBookTransfer({pool,snapshotHash:plan.snapshotHash})).verified,true);
  const target=await openPostgresBookQueue({pool,now:()=>100});const saved=await target.get(job.id);assert.deepEqual(saved.checkpoint,snapshot.jobs[0].checkpoint);
  await assert.rejects(target.complete(job.id,lease.token,{result:{},metrics:{}}),/Lease rejected/);
  await rollbackBookTransfer({pool,snapshotHash:plan.snapshotHash});assert.deepEqual(await target.list(),[]);
  await applyBookTransfer(opts);assert.deepEqual((await target.get(job.id)).payload,snapshot.jobs[0].payload);
 });assert.equal(hash(await source.exportSnapshot()),before);
});

test('mixed legacy and wire rows remain unchanged by reads and ordinal-only compaction',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);
  const make=(page,state='queued')=>{const data={sourceHash:'a'.repeat(64),edition:'legacy',page,extractionVersion:'v0',payload:{original:true}};return {...data,id:hash([data.sourceHash,data.edition,page,data.extractionVersion]),state,attempts:state==='completed'?1:0,createdAt:100,updatedAt:100}};
  const legacy=make(1,'completed'),remove=make(2),tail=make(3);
  const receipt={candidateDigest:'c'.repeat(64),decision:'rejected',reviewer:'legacy reviewer',reason:'legacy reason',reviewedAt:'2026-10-17T00:00:00.000Z',visualVerified:false};
  legacy.result={digest:receipt.candidateDigest,reviewReceipt:receipt};legacy.metrics={reviewDecisions:1};
  for(const [ordinal,job] of [legacy,remove,tail].entries())await pool.query('INSERT INTO mu_book_jobs(sqlite_id,ordinal,document) VALUES($1,$2,$3)',[job.id,ordinal,job]);
  await pool.query('INSERT INTO mu_book_reviews(sqlite_id,candidate_digest,receipt) VALUES($1,$2,$3)',[legacy.id,receipt.candidateDigest,receipt]);
  const target=await openPostgresBookQueue({pool,now:()=>100});await target.list();await target.exportSnapshot();await target.recordReview(legacy.id,receipt);
  assert.equal((await pool.query('SELECT receipt_encoding FROM mu_book_reviews')).rows[0].receipt_encoding,0);
  const fresh=await target.enqueue(input());assert.equal((await target.list()).length,4);
  await transactionBookSnapshot(pool,{now:()=>100},d=>{d.jobs=d.jobs.filter(j=>j.id!==remove.id)});
  assert.deepEqual((await pool.query('SELECT document_encoding FROM mu_book_jobs WHERE sqlite_id IN ($1,$2) ORDER BY ordinal',[legacy.id,tail.id])).rows.map(r=>r.document_encoding),[0,0]);
  assert.equal((await pool.query('SELECT document_encoding FROM mu_book_jobs WHERE sqlite_id=$1',[fresh.id])).rows[0].document_encoding,1);
  await transactionBookSnapshot(pool,{now:()=>100},d=>{d.jobs.find(j=>j.id===legacy.id).payload.unicode='\0\udfff'});
  assert.equal((await pool.query('SELECT document_encoding FROM mu_book_jobs WHERE sqlite_id=$1',[legacy.id])).rows[0].document_encoding,1);
  assert.equal((await pool.query('SELECT receipt_encoding FROM mu_book_reviews')).rows[0].receipt_encoding,0);
  assert.equal((await target.get(legacy.id)).payload.unicode,'\0\udfff');
 });
});

test('corrupt wire, mismatched projection and unknown versions fail closed without fallback',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);const target=await openPostgresBookQueue({pool,now:()=>100}),job=await target.enqueue(input());
  const original=(await pool.query('SELECT document,document_wire FROM mu_book_jobs')).rows[0];
  await pool.query("UPDATE mu_book_jobs SET document_wire=jsonb_set(document_wire,'{sha256}',to_jsonb($1::text))",['0'.repeat(64)]);
  await assert.rejects(target.get(job.id),/Corrupt Book JSON/);
  await pool.query('UPDATE mu_book_jobs SET document_wire=$1',[original.document_wire]);
  await pool.query("UPDATE mu_book_jobs SET document=jsonb_set(document,'{payload}','{\"forged\":true}')");
  await assert.rejects(target.list(),/projection mismatch/);
  await pool.query('UPDATE mu_book_jobs SET document=$1',[original.document]);
  await assert.rejects(pool.query('UPDATE mu_book_jobs SET document_encoding=9'));
  await assert.rejects(pool.query('UPDATE mu_book_jobs SET document_encoding=0,document_wire=NULL'),/downgrade/);
  await assert.rejects(pool.query("UPDATE mu_book_jobs SET document_wire=jsonb_set(document_wire,'{schemaVersion}','\"book-json/v2\"')"));
  assert.deepEqual((await target.get(job.id)).payload,input().payload);
 });
});

test('native same-clock queue order and transfer hashes match SQLite scheduling order',{skip:!url},async t=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'book-wire-order-')));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);const sqlite=await openBookQueue({directory,now:()=>100}),postgres=await openPostgresBookQueue({pool,now:()=>100});
  const records=[1,2,3].map(page=>({...input(),page})).sort((a,b)=>hash([b.sourceHash,b.edition,b.page,b.extractionVersion]).localeCompare(hash([a.sourceHash,a.edition,a.page,a.extractionVersion])));
  for(const item of records){await sqlite.enqueue(item);await postgres.enqueue(item)}
  assert.deepEqual((await postgres.identityMap()).map(m=>m.sqliteId),(await sqlite.list()).map(j=>j.id));
  assert.deepEqual((await postgres.list()).map(j=>j.id),(await sqlite.list()).map(j=>j.id));
 });
});
test('near-field-limit native text traverses SQL wire without normalization or truncation',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);const target=await openPostgresBookQueue({pool,now:()=>100});
  const job=await target.enqueue({...input(),payload:{raw:'\ud800'.repeat(8000)}}),lease=await target.acquire({workerId:'field-limits',leaseMs:1000});
  const checkpoint={raw:'\0'.repeat(40000)},result={raw:'\udfff'.repeat(40000)};
  await target.checkpoint(job.id,lease.token,checkpoint);await target.complete(job.id,lease.token,{result,metrics:{cost:0}});
  const saved=await target.get(job.id);assert.deepEqual(saved.checkpoint,checkpoint);assert.deepEqual(saved.result,result);assert.equal(saved.payload.raw,'\ud800'.repeat(8000));
  assert.ok((await pool.query('SELECT document_wire FROM mu_book_jobs')).rows[0].document_wire.byteLength>500000);
 });
});

test('concurrent wire enqueue/claim/import retain ID hashes and acquisition fencing',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);let time=100;
  const [a,b]=await Promise.all([openPostgresBookQueue({pool,now:()=>time}),openPostgresBookQueue({pool,now:()=>time})]);
  const jobs=await Promise.all([a.enqueue(input()),b.enqueue(input())]);assert.equal(jobs[0].id,jobs[1].id);assert.equal((await a.list()).length,1);
  const mapping=await a.identityMap();const claims=await Promise.all([a.acquire({workerId:'a\ud800',leaseMs:10}),b.acquire({workerId:'b\0',leaseMs:10})]);assert.equal(claims.filter(Boolean).length,1);
  const old=claims.find(Boolean);await a.checkpoint(old.id,old.token,{unicode:input().payload});time=110;
  const fresh=await b.acquire({workerId:'reclaimed\udfff',leaseMs:100});assert.notEqual(fresh.token,old.token);assert.deepEqual(fresh.checkpoint,{unicode:input().payload});
  for(const operation of [()=>a.renew(old.id,old.token,{leaseMs:10}),()=>a.checkpoint(old.id,old.token,{}),()=>a.complete(old.id,old.token,{result:{},metrics:{}}),()=>a.fail(old.id,old.token,{code:'STALE'})])await assert.rejects(operation,/Lease rejected/);
  assert.deepEqual(await a.identityMap(),mapping);
 });
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);const data=input(),job={...data,id:hash([data.sourceHash,data.edition,data.page,data.extractionVersion]),state:'queued',attempts:0,createdAt:100,updatedAt:100};
  const snapshot={schemaVersion:1,maxAttempts:3,jobs:[job]},expectedHash=planBookTransfer({snapshot}).snapshotHash,opts={pool,snapshot,expectedHash,now:()=>100};
  const results=await Promise.all([applyBookTransfer(opts),applyBookTransfer(opts)]);assert.deepEqual(results.map(r=>r.repeated).sort(),[false,true]);
  const target=await openPostgresBookQueue({pool,now:()=>100});assert.equal((await target.list()).length,1);assert.deepEqual((await target.exportSnapshot()).jobs,[job]);
  await rollbackBookTransfer({pool,snapshotHash:expectedHash});assert.deepEqual(await target.list(),[]);
 });
});
