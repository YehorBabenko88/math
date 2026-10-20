import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const verifier=fileURLToPath(new URL('../scripts/verify-sql-bytes.mjs',import.meta.url));
function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim()}
test('SQL byte policy survives LF/CRLF checkout settings and verifier rejects modified bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'sql-bytes-'));
 try{
  git(root,'init','-q');git(root,'config','user.email','fixture@example.invalid');git(root,'config','user.name','Fixture');
  mkdirSync(join(root,'sql','book'),{recursive:true});
  writeFileSync(join(root,'.gitattributes'),readFileSync(new URL('../.gitattributes',import.meta.url)));
  writeFileSync(join(root,'sql','001.sql'),'SELECT 1;\n');writeFileSync(join(root,'sql','book','001.sql'),'SELECT 2;\r\n');
  git(root,'add','.');git(root,'commit','-qm','fixture');
  for(const autocrlf of ['false','true']){
   rmSync(join(root,'sql'),{recursive:true});git(root,'-c',`core.autocrlf=${autocrlf}`,'checkout','HEAD','--','sql');
   assert.equal(readFileSync(join(root,'sql','001.sql'),'utf8'),'SELECT 1;\n');
   assert.equal(readFileSync(join(root,'sql','book','001.sql'),'utf8'),'SELECT 2;\r\n');
   execFileSync(process.execPath,[verifier],{cwd:root});
  }
  writeFileSync(join(root,'sql','001.sql'),'SELECT 1;\r\n');
  assert.throws(()=>execFileSync(process.execPath,[verifier],{cwd:root,stdio:'pipe'}),error=>error.status===1&&error.stderr.toString().includes('SQL_CHECKOUT_BYTES_MISMATCH'));
  // Staging altered bytes must not bless them as the committed execution source.
  git(root,'add','sql/001.sql');
  assert.throws(()=>execFileSync(process.execPath,[verifier],{cwd:root,stdio:'pipe'}),error=>error.status===1);
 }finally{rmSync(root,{recursive:true,force:true})}
});

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
