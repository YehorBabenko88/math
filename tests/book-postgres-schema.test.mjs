import test from 'node:test';
import assert from 'node:assert/strict';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
test('Book migrations have their own ledger and lock and apply exactly once',async()=>{
 const calls=[],done=[];let released;
 const client={async query(sql,args){calls.push(sql);if(sql==='SELECT filename FROM mu_book_schema_migrations')return {rows:done.map(filename=>({filename}))};if(sql.startsWith('INSERT INTO mu_book_schema_migrations'))done.push(args[0]);return {rows:[]}},release(error){released=error??true}};
 const pool={async connect(){return client}};
 assert.deepEqual(await applyBookMigrations(pool),['001_book_queue.sql','002_lossless_json.sql','003_cutover_guard.sql','004_cutover_snapshot_fence.sql']);
 assert.deepEqual(await applyBookMigrations(pool),[]);
 assert.ok(calls.includes('SELECT pg_advisory_xact_lock(732814,2)'));
 assert.equal(calls.filter(s=>s.includes('CREATE TABLE mu_book_jobs')).length,1);
 assert.equal(calls.at(-1),'COMMIT');assert.equal(released,true);
});
test('Book migrations reject embedded transaction control and preserve original error when rollback fails',async()=>{
 const original=Error('migration failed'),rollback=Error('rollback failed');let released;
 const client={async query(sql){if(sql==='SELECT filename FROM mu_book_schema_migrations')return {rows:[]};if(sql==='ROLLBACK')throw rollback;if(sql.includes('broken'))throw original;return {rows:[]}},release(e){released=e}};
 await assert.rejects(applyBookMigrations({connect:async()=>client},{readSql:async()=> 'BEGIN; SELECT broken; COMMIT;'}),e=>e===original);
 assert.equal(released,rollback);
 await assert.rejects(applyBookMigrations({connect:async()=>client},{readSql:async()=> 'BEGIN; COMMIT; SELECT 1; COMMIT;'}),/transaction control/);
});
