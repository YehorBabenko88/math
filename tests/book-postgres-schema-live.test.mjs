import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {migrationBody} from '../src/postgres-migrations.mjs';
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
import {withIsolatedPostgres} from './helpers/postgres-isolation.mjs';
const url=process.env.MATH_UNIVERSE_TEST_DATABASE_URL;
const enabled=Boolean(url);
const id='a'.repeat(64);
const job={id,sourceHash:'b'.repeat(64),edition:'edition',page:1,extractionVersion:'v1',payload:{},state:'queued',attempts:0,createdAt:1,updatedAt:1};
const envelope={schemaVersion:'book-json/v1',encoding:'base64-utf8-json',byteLength:2,sha256:'c'.repeat(64),data:'e30='};

test('Book schema live: legacy upgrades preserve IDs and JSON while mixed wire versions are checked',{skip:!enabled},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  const sql=await readFile(new URL('../sql/book/001_book_queue.sql',import.meta.url),'utf8');
  await pool.query(migrationBody(sql,'001_book_queue.sql'));
  await pool.query('CREATE TABLE mu_book_schema_migrations(filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
  await pool.query("INSERT INTO mu_book_schema_migrations(filename) VALUES ('001_book_queue.sql')");
  const legacy={...job,payload:{text:'λ',nested:{kept:true}}};
  const before=(await pool.query('INSERT INTO mu_book_jobs(sqlite_id,ordinal,document) VALUES($1,0,$2) RETURNING *',[id,legacy])).rows[0];
  assert.deepEqual(await applyBookMigrations(pool),['002_lossless_json.sql','003_cutover_guard.sql','004_cutover_snapshot_fence.sql']);
  const after=(await pool.query('SELECT * FROM mu_book_jobs')).rows[0];
  assert.equal(after.postgres_id,before.postgres_id);assert.equal(after.sqlite_id,id);
  assert.deepEqual(after.document,legacy);assert.equal(after.document_encoding,0);assert.equal(after.document_wire,null);
  const update=(encoding,wire)=>pool.query('UPDATE mu_book_jobs SET document_encoding=$1,document_wire=$2',[encoding,wire]);
  for(const encoding of [-1,2,32767])await assert.rejects(update(encoding,null));
  await assert.rejects(update(0,envelope));await assert.rejects(update(1,null));
  const bad=[[],{}, {...envelope,extra:true},{...envelope,schemaVersion:'book-json/v2'},{...envelope,encoding:'raw'},
   {...envelope,byteLength:-1},{...envelope,byteLength:0.5},{...envelope,byteLength:8388609},{...envelope,byteLength:'2'},
   {...envelope,sha256:'C'.repeat(64)},{...envelope,sha256:null},{...envelope,data:'λ'},{...envelope,data:'e3=='+'AAAA'},
   {...envelope,data:'e30=\n'},{...envelope,data:'e30'},{...envelope,data:null}];
  for(const wire of bad)await assert.rejects(update(1,wire),undefined,JSON.stringify(wire));
  await update(1,envelope);
  const receipt={candidateDigest:'c'.repeat(64),decision:'approved',reviewer:'human',reason:'checked',reviewedAt:'2026-01-01T00:00:00.000Z',visualVerified:true};
  await pool.query('INSERT INTO mu_book_reviews(sqlite_id,candidate_digest,receipt) VALUES($1,$2,$3)',[id,receipt.candidateDigest,receipt]);
  for(const [encoding,wire] of [[2,null],[0,envelope],[1,null],[1,{...envelope,byteLength:8193}],[1,{...envelope,schemaVersion:'book-json/v2'}]]){
   await assert.rejects(pool.query('UPDATE mu_book_reviews SET receipt_encoding=$1,receipt_wire=$2',[encoding,wire]));
  }
  await pool.query('UPDATE mu_book_reviews SET receipt_encoding=1,receipt_wire=$1',[envelope]);
  await assert.rejects(update(0,null),/downgrade/);
  await assert.rejects(pool.query('UPDATE mu_book_reviews SET receipt_encoding=0,receipt_wire=NULL'),/downgrade/);
  const secondId='d'.repeat(64);
  await pool.query('INSERT INTO mu_book_jobs(sqlite_id,ordinal,document) VALUES($1,1,$2)',[secondId,{...legacy,id:secondId}]);
  assert.deepEqual((await pool.query('SELECT document_encoding FROM mu_book_jobs ORDER BY ordinal')).rows.map(r=>r.document_encoding),[1,0]);
  assert.deepEqual((await pool.query('SELECT document FROM mu_book_jobs WHERE sqlite_id=$1',[id])).rows[0].document,legacy);
 });
});
test('Book schema live: concurrent migration is idempotent and invalid documents cannot bypass checks',{skip:!enabled},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  const applied=await Promise.all([applyBookMigrations(pool),applyBookMigrations(pool)]);
  assert.deepEqual(applied.map(a=>a.length).sort(),[0,4]);
  assert.equal((await pool.query('SELECT * FROM mu_book_schema_migrations')).rows.length,4);
  await pool.query('INSERT INTO mu_book_queue(max_attempts) VALUES (3)');
  await assert.rejects(pool.query('INSERT INTO mu_book_queue(singleton,max_attempts) VALUES(false,3)'));
  await assert.rejects(pool.query('UPDATE mu_book_queue SET max_attempts=11'));
  const insert=document=>pool.query('INSERT INTO mu_book_jobs(sqlite_id,ordinal,document) VALUES($1,0,$2)',[id,document]);
  for(const key of ['id','sourceHash','edition','page','extractionVersion','payload','state','attempts','createdAt','updatedAt']){
   const missing={...job};delete missing[key];await assert.rejects(insert(missing),undefined,'missing '+key);
   await assert.rejects(insert({...job,[key]:null}),undefined,'null '+key);
  }
  for(const patch of [{page:1.5},{state:'leased'},{token:null},{result:{}},{metrics:{}},{state:'completed',attempts:1,result:{}},{state:'failed',attempts:1}])await assert.rejects(insert({...job,...patch}));
  await insert(job);
  const leased={...job,state:'leased',attempts:1,token:'d'.repeat(64),workerId:'worker',leaseUntil:20};
  await pool.query('UPDATE mu_book_jobs SET document=$1',[leased]);
  const completed={...job,state:'completed',attempts:1,result:{digest:'c'.repeat(64)},metrics:{durationMs:2}};
  await pool.query('UPDATE mu_book_jobs SET document=$1',[completed]);
  const receipt={candidateDigest:'c'.repeat(64),decision:'approved',reviewer:'human',reason:'checked',reviewedAt:'2026-01-01T00:00:00.000Z',visualVerified:true};
  const review=r=>pool.query('INSERT INTO mu_book_reviews(sqlite_id,candidate_digest,receipt) VALUES($1,$2,$3)',[id,receipt.candidateDigest,r]);
  for(const key of Object.keys(receipt)){const missing={...receipt};delete missing[key];await assert.rejects(review(missing));await assert.rejects(review({...receipt,[key]:null}));}
  await review(receipt);
  await pool.query('DELETE FROM mu_book_jobs');assert.equal((await pool.query('SELECT * FROM mu_book_reviews')).rows.length,0);
 });
});
test('Book schema live: a failed migration rolls back DDL and ledger atomically',{skip:!enabled},async()=>{
 await withIsolatedPostgres(url,async({pool})=>{
  await assert.rejects(applyBookMigrations(pool,{readSql:async name=>name==='001_book_queue.sql'?readFile(new URL('../sql/book/'+name,import.meta.url),'utf8'):'BEGIN; CREATE TABLE mu_book_probe(id int); SELECT missing_book_function(); COMMIT;'}));
  assert.equal((await pool.query("SELECT to_regclass('mu_book_probe') AS probe,to_regclass('mu_book_schema_migrations') AS ledger")).rows[0].probe,null);
  assert.equal((await pool.query("SELECT to_regclass('mu_book_schema_migrations') AS ledger,to_regclass('mu_book_jobs') AS jobs")).rows[0].ledger,null);
  assert.equal((await pool.query("SELECT to_regclass('mu_book_jobs') AS jobs")).rows[0].jobs,null);
  assert.deepEqual(await applyBookMigrations(pool),['001_book_queue.sql','002_lossless_json.sql','003_cutover_guard.sql','004_cutover_snapshot_fence.sql']);
 });
});
