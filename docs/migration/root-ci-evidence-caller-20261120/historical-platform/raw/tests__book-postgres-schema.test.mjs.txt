import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {loadBookMigrationManifest,applyBookMigrations,BOOK_MIGRATIONS} from '../src/book-ingestion/postgres-migrations.mjs';
test('Book manifest hashes exact raw UTF-8 bytes including CRLF and BOM',async()=>{
 const manifest=await loadBookMigrationManifest();assert.equal(manifest.length,5);
 for(const row of manifest){const raw=await readFile(new URL('../sql/book/'+row.filename,import.meta.url));assert.equal(row.sha256,createHash('sha256').update(raw).digest('hex'));assert.equal(row.byteLength,raw.length);assert.equal(row.hashContract,'sha256-raw-utf8/v1');}
 const base=await loadBookMigrationManifest({readSql:async()=> 'BEGIN; SELECT 1; COMMIT;'});
 for(const input of ['\uFEFFBEGIN; SELECT 1; COMMIT;','BEGIN;\r\nSELECT 1; COMMIT;'])assert.notEqual((await loadBookMigrationManifest({readSql:async()=>input}))[0].sha256,base[0].sha256);
 assert.ok(Object.isFrozen(BOOK_MIGRATIONS));
});
test('malformed UTF-8 and transaction control are rejected before connecting',async()=>{
 let connected=0;const pool={async connect(){connected++;throw Error('unexpected connection');}};
 for(const input of [Buffer.from([255]),'\ud800','',true])await assert.rejects(applyBookMigrations(pool,{readSql:async()=>input}),/BOOK_MIGRATION_SOURCE_INVALID/);
 await assert.rejects(applyBookMigrations(pool,{readSql:async()=> 'BEGIN; COMMIT; SELECT 1; COMMIT;'}),/transaction control/);
 assert.equal(connected,0);
});
