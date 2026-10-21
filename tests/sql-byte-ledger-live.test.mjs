import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

for(const [kind,apply,inspect,directory] of [
 ['generic',(await import('../src/postgres-migrations.mjs')).applyMathMigrations,(await import('../src/postgres-migrations.mjs')).inspectMathMigrationLedger,'../sql/'],
 ['book',(await import('../src/book-ingestion/postgres-migrations.mjs')).applyBookMigrations,(await import('../src/book-ingestion/postgres-migrations.mjs')).inspectBookMigrationLedger,'../sql/book/'],
]){
 const {withIsolatedPostgres}=await import('./helpers/postgres-isolation.mjs');
 const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
 test(`${kind}: previously executed CRLF ledger rejects LF checkout without rewriting history`,{skip:!url},()=>withIsolatedPostgres(url,async({pool})=>{
  const readSql=async name=>Buffer.from(readFileSync(new URL(directory+name,import.meta.url),'utf8').replace(/\r?\n/g,'\r\n'));
  await apply(pool,{readSql});
  const table=kind==='generic'?'mu_schema_migrations':'mu_book_schema_migrations';
  const before=(await pool.query(`SELECT * FROM ${table} ORDER BY filename`)).rows;
  await assert.rejects(apply(pool),/MIGRATION_CONTENT_CHANGED/);
  await assert.rejects(inspect(pool),/MIGRATION_CONTENT_CHANGED/);
  assert.deepEqual((await pool.query(`SELECT * FROM ${table} ORDER BY filename`)).rows,before);
  assert.deepEqual(await apply(pool,{readSql}),[]);
 }));
}
