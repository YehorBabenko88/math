import test from 'node:test';
import assert from 'node:assert/strict';

test('native PostgreSQL queue exposes the shared API without schema auto-migration',async()=>{
 const {openPostgresBookQueue}=await import('../src/book-ingestion/postgres-queue.mjs');
 const statements=[];
 const pool={async connect(){return {async query(sql){statements.push(sql);if(sql.includes('SELECT version'))return {rows:[{version:1,max_attempts:3}]};if(sql.includes('FROM mu_book_jobs'))return {rows:[]};if(sql.includes('FROM mu_book_reviews'))return {rows:[]};if(sql.includes('clock_timestamp'))return {rows:[{time:'1000'}]};return {rows:[]}},release(){}}}};
 const q=await openPostgresBookQueue({pool});
 assert.deepEqual(await q.list(),[]);
 assert.deepEqual(await q.identityMap(),[]);
 assert.equal(typeof q.recordReview,'function');
 assert.ok(statements.some(sql=>sql.includes('FOR UPDATE')));
 assert.ok(!statements.some(sql=>/CREATE TABLE|ALTER TABLE/.test(sql)));
});

test('transaction rollback preserves callback error and discards a broken client',async()=>{
 const {transactionBookSnapshot}=await import('../src/book-ingestion/postgres-queue.mjs');
 const original=Error('callback failed'),rollback=Error('rollback failed');let released;
 const pool={async connect(){return {async query(sql){if(sql==='ROLLBACK')throw rollback;if(sql.includes('SELECT version'))return {rows:[{version:1,max_attempts:3}]};if(sql.includes('FROM mu_book_jobs')||sql.includes('FROM mu_book_reviews'))return {rows:[]};return {rows:[]}},release(error){released=error}}}};
 await assert.rejects(transactionBookSnapshot(pool,{maxAttempts:3,now:()=>1000},()=>{throw original}),e=>e===original);
 assert.equal(released,rollback);
});
