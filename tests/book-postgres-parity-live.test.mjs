import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
import {openPostgresBookQueue} from '../src/book-ingestion/postgres-queue.mjs';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
import {planBookTransfer,applyBookTransfer} from '../src/book-ingestion/postgres-transfer.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const input={sourceHash:'a'.repeat(64),edition:'synthetic',page:1,extractionVersion:'1',payload:{sourceVersion:'scan-1',allowExternalProcessing:false}};

test('native SQLite text roundtrips through PostgreSQL wire without changes',{skip:!url},async t=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'book-json-parity-')));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const source=await openBookQueue({directory,now:()=>100});
 for(const [i,raw] of ['a\0b','\ud800','\udfff'].entries())await source.enqueue({...input,page:i+1,payload:{raw}});
 const snapshot=await source.exportSnapshot(),before=JSON.stringify(snapshot),plan=planBookTransfer({snapshot});
 assert.equal(plan.unsupportedIds.length,0);assert.ok(plan.blockers.includes('operator-cutover-prerequisites'));
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);await applyBookTransfer({pool,snapshot,expectedHash:plan.snapshotHash});
  const target=await openPostgresBookQueue({pool,now:()=>100});assert.deepEqual((await target.list()).map(j=>j.payload),snapshot.jobs.map(j=>j.payload));
  assert.equal((await target.enqueue({...input,payload:{raw:'a\0b'}})).id,snapshot.jobs.find(j=>j.page===1).id);assert.equal((await pool.query('SELECT * FROM mu_book_imports')).rowCount,1);
 });
 assert.equal(JSON.stringify(await source.exportSnapshot()),before);
});

test('Book PostgreSQL and SQLite preserve the same completed review snapshot and restore contract',{skip:!url},async t=>{
 const dirs=[];const directory=()=>{const d=realpathSync(mkdtempSync(join(tmpdir(),'book-parity-')));dirs.push(d);return d};
 t.after(()=>{for(const d of dirs)rmSync(d,{recursive:true,force:true})});
 await withIsolatedPostgres(url,async({pool})=>{
  await applyBookMigrations(pool);let time=100;
  const sqlite=await openBookQueue({directory:directory(),now:()=>time}),postgres=await openPostgresBookQueue({pool,now:()=>time});
  const receipt={candidateDigest:'c'.repeat(64),decision:'approved',reviewer:'Synthetic human',reason:'Test receipt only',reviewedAt:'2026-10-16T00:00:00.000Z',visualVerified:true};
  for(const queue of [sqlite,postgres]){
   const job=await queue.enqueue(input);
   assert.equal((await queue.enqueue({...input,payload:{different:true}})).id,job.id);
   const lease=await queue.acquire({workerId:'test',leaseMs:1000});
   await queue.checkpoint(job.id,lease.token,{provenance:input,stage:'review_required'});
   await queue.renew(job.id,lease.token,{leaseMs:2000});
   await queue.complete(job.id,lease.token,{result:{digest:receipt.candidateDigest,stage:'review_required',claims:[{status:'untested'}]},metrics:{cost:1.5,pagesAttempted:1}});
   await queue.recordReview(job.id,receipt);await queue.recordReview(job.id,receipt);
   await assert.rejects(queue.recordReview(job.id,{...receipt,decision:'rejected'}));
  }
  const snapshot=await sqlite.exportSnapshot();assert.deepEqual(await postgres.exportSnapshot(),snapshot);
  const restored=await openBookQueue({directory:directory(),now:()=>time});await restored.importSnapshot(await postgres.exportSnapshot());
  assert.deepEqual(await restored.exportSnapshot(),snapshot);
  assert.equal((await postgres.identityMap())[0].sqliteId,snapshot.jobs[0].id);
 });
});

test('Book PostgreSQL rolls back an interrupted writer process and preserves checkpoint',{skip:!url},async()=>{
 await withIsolatedPostgres(url,async({pool,schema})=>{
  await applyBookMigrations(pool);const queue=await openPostgresBookQueue({pool});
  const job=await queue.enqueue(input),lease=await queue.acquire({workerId:'original',leaseMs:60000});
  await queue.checkpoint(job.id,lease.token,{stage:'review_required',sourceHash:input.sourceHash});
  const before=await queue.get(job.id);
  const source=`import pg from 'pg';
  const p=new pg.Pool({connectionString:process.env.MATH_UNIVERSE_TEST_DATABASE_URL,options:'-c search_path='+process.env.MU_BOOK_SCHEMA});
  const c=await p.connect();await c.query('BEGIN');await c.query('SELECT * FROM mu_book_queue FOR UPDATE');
  await c.query("UPDATE mu_book_jobs SET document=jsonb_set(document,'{checkpoint}', $1::jsonb)",[JSON.stringify({crash:true})]);
  console.log('UNCOMMITTED');setInterval(()=>{},1000);`;
  const child=spawn(process.execPath,['--input-type=module','--eval',source],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,MU_BOOK_SCHEMA:schema}});
  const exit=once(child,'exit');let timer;
  try{
   await new Promise((resolve,reject)=>{let data='';timer=setTimeout(()=>reject(Error('Writer acknowledgement timeout')),10000);child.stdout.on('data',part=>{data+=part;if(data.includes('UNCOMMITTED'))resolve()});child.once('error',reject);child.once('exit',()=>reject(Error('Writer exited early')))});
   clearTimeout(timer);child.kill('SIGKILL');await exit;
   assert.deepEqual(await queue.get(job.id),before);
   await queue.complete(job.id,lease.token,{result:{stage:'review_required'},metrics:{}});
  }finally{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exit}}
 });
});
