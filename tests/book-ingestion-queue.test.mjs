import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync,symlinkSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {once} from 'node:events';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
const input={sourceHash:'a'.repeat(64),edition:'Synthetic 2026',page:1,extractionVersion:'v1',payload:{documentId:'local-fixture'}};
function directory(t){const d=mkdtempSync(join(tmpdir(),'math-book-queue-'));t.after(()=>rmSync(d,{recursive:true,force:true}));return d;}

test('queue rejects sparse arrays disguised with non-index numeric properties without data loss',async t=>{
 const q=await openBookQueue({directory:directory(t)}),values=[1];values.length=2;values[4294967295]='extra';
 await assert.rejects(q.enqueue({...input,payload:{values}}));assert.deepEqual(await q.list(),[]);
 const job=await q.enqueue(input),lease=await q.acquire({workerId:'test',leaseMs:10000});
 await assert.rejects(q.checkpoint(job.id,lease.token,{values}));assert.equal((await q.get(job.id)).checkpoint,undefined);
 await assert.rejects(q.complete(job.id,lease.token,{result:{values},metrics:{}}));assert.equal((await q.get(job.id)).state,'leased');
});

test('renew preserves acquisition identity and checkpoint, rejects exact expiry and stale reclaimed token',async t=>{
 let time=100;const d=directory(t),q=await openBookQueue({directory:d,now:()=>time});const job=await q.enqueue(input),first=await q.acquire({workerId:'same',leaseMs:10});
 await q.checkpoint(job.id,first.token,{stage:'parsed'});time=105;
 const renewed=await q.renew(job.id,first.token,{leaseMs:20});assert.equal(renewed.leaseUntil,125);assert.equal(renewed.token,first.token);assert.equal(renewed.attempts,1);assert.deepEqual(renewed.checkpoint,{stage:'parsed'});
 const reopened=await openBookQueue({directory:d,now:()=>time});assert.deepEqual(await reopened.get(job.id),renewed);
 for(const leaseMs of [0,86400001,1.5])await assert.rejects(q.renew(job.id,first.token,{leaseMs}));
 await assert.rejects(q.renew(job.id,'f'.repeat(64),{leaseMs:20}),/Lease rejected/);
 time=125;await assert.rejects(q.renew(job.id,first.token,{leaseMs:20}),/Lease rejected/);
 const next=await q.acquire({workerId:'same',leaseMs:20});assert.notEqual(next.token,first.token);assert.equal(next.attempts,2);assert.deepEqual(next.checkpoint,{stage:'parsed'});
 await assert.rejects(q.renew(job.id,first.token,{leaseMs:20}),/Lease rejected/);await q.complete(job.id,next.token,{result:{},metrics:{}});
 await assert.rejects(q.renew(job.id,next.token,{leaseMs:20}),/Lease rejected/);
});

test('snapshot import enforces individual checkpoint and result bounds',async t=>{
 const q=await openBookQueue({directory:directory(t)});await q.enqueue(input);const lease=await q.acquire({workerId:'x',leaseMs:10000});await q.complete(lease.id,lease.token,{result:{},metrics:{}});
 const snapshot=await q.exportSnapshot(),target=await openBookQueue({directory:directory(t)});
 for(const field of ['checkpoint','result']){const bad=structuredClone(snapshot);bad.jobs[0][field]={large:'x'.repeat(262144)};await assert.rejects(target.importSnapshot(bad),/Invalid queue state/);assert.deepEqual(await target.list(),[]);}
});
test('dedup persists original payload and completion across instances and restart',async t=>{
 const d=directory(t),a=await openBookQueue({directory:d}),b=await openBookQueue({directory:d});
 const [first,duplicate]=await Promise.all([a.enqueue(input),b.enqueue({...input,payload:{changed:true}})]);
 assert.equal(first.id,duplicate.id);assert.deepEqual(duplicate.payload,input.payload);
 const [lease,none]=await Promise.all([a.acquire({workerId:'a',leaseMs:10000}),b.acquire({workerId:'b',leaseMs:10000})]);assert.equal(none,null);
 await a.checkpoint(lease.id,lease.token,{stage:'extracted'});
 await a.complete(lease.id,lease.token,{result:{candidateId:'one'},metrics:{pagesAttempted:1}});
 const reopened=await openBookQueue({directory:d});const original=await reopened.enqueue({...input,payload:{changed:true}});
 assert.equal(original.state,'completed');assert.deepEqual(original.result,{candidateId:'one'});assert.deepEqual(original.checkpoint,{stage:'extracted'});
 original.result.candidateId='tampered';assert.equal((await reopened.get(first.id)).result.candidateId,'one');
 await assert.rejects(a.complete(lease.id,lease.token,{result:{},metrics:{}}));
});
test('expired lease fencing, recovery on reopen and bounded retries',async t=>{
 const d=directory(t);let time=100;const now=()=>time;const a=await openBookQueue({directory:d,now,maxAttempts:2});await a.enqueue(input);
 const first=await a.acquire({workerId:'one',leaseMs:10});time=110;
 await assert.rejects(a.complete(first.id,first.token,{result:{},metrics:{}}));
 const b=await openBookQueue({directory:d,now,maxAttempts:2});const second=await b.acquire({workerId:'two',leaseMs:10});assert.equal(second.attempts,2);assert.notEqual(second.token,first.token);
 await assert.rejects(a.checkpoint(first.id,first.token,{}));
 assert.equal((await b.fail(second.id,second.token,{code:'EXTRACTION_FAILED'})).state,'failed');assert.equal(await b.acquire({workerId:'three',leaseMs:10}),null);
});
test('retryable failures queue again; permanent failures stop immediately',async t=>{
 const q=await openBookQueue({directory:directory(t)});await q.enqueue(input);let j=await q.acquire({workerId:'x',leaseMs:10000});assert.equal((await q.fail(j.id,j.token,{code:'TEMPORARY'})).state,'queued');j=await q.acquire({workerId:'x',leaseMs:10000});assert.equal((await q.fail(j.id,j.token,{code:'INVALID_PDF',retryable:false})).state,'failed');
});
test('snapshot restore only into empty store; corrupt state fails closed; orphan temp ignored',async t=>{
 const d=directory(t),q=await openBookQueue({directory:d});await q.enqueue(input);const snapshot=await q.exportSnapshot();const b=await openBookQueue({directory:directory(t)});await b.importSnapshot(snapshot);assert.equal((await b.list()).length,1);await assert.rejects(b.importSnapshot(snapshot));
 writeFileSync(join(d,'.orphan.tmp'),'{partial');assert.equal((await (await openBookQueue({directory:d})).list()).length,1);
 writeFileSync(join(d,'queue.sqlite'),'{partial');await assert.rejects(openBookQueue({directory:d}),/Invalid queue state/);assert.equal(readFileSync(join(d,'queue.sqlite'),'utf8'),'{partial');
});
test('independent processes deduplicate and acquire only one lease',async t=>{
 const d=directory(t),moduleUrl=new URL('../src/book-ingestion/queue.mjs',import.meta.url).href;
 const script=`import {openBookQueue} from ${JSON.stringify(moduleUrl)};const q=await openBookQueue({directory:${JSON.stringify(d)}});await q.enqueue(${JSON.stringify(input)});console.log(JSON.stringify(await q.acquire({workerId:'process',leaseMs:10000})));`;
 const results=await Promise.all([1,2].map(()=>promisify(execFile)(process.execPath,['--input-type=module','-e',script])));
 assert.equal(results.map(r=>JSON.parse(r.stdout)).filter(Boolean).length,1);
 const q=await openBookQueue({directory:d});assert.equal((await q.list()).length,1);
});
test('first-open waits for a concurrently created empty SQLite file to become initialized',async t=>{
 const d=directory(t),file=join(d,'queue.sqlite');writeFileSync(file,'');
 const opening=openBookQueue({directory:d});
 await new Promise(resolve=>setTimeout(resolve,40));
 const db=new DatabaseSync(file);
 try{
  db.exec(`CREATE TABLE queue_metadata(singleton INTEGER PRIMARY KEY CHECK(singleton=1),version INTEGER NOT NULL,maxAttempts INTEGER NOT NULL);
    CREATE TABLE jobs(id TEXT PRIMARY KEY,sourceHash TEXT NOT NULL,edition TEXT NOT NULL,page INTEGER NOT NULL,extractionVersion TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL,token TEXT,leaseUntil INTEGER,workerId TEXT,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL,checkpoint TEXT,result TEXT,metrics TEXT,errorCode TEXT);
    CREATE INDEX jobs_state_lease ON jobs(state,leaseUntil);`);
  db.prepare('INSERT INTO queue_metadata VALUES (1,1,3)').run();
 }finally{db.close();}
 const queue=await opening;assert.deepEqual(await queue.list(),[]);
});
test('persistent empty first-open file times out without creating metadata',async t=>{
 const d=directory(t),file=join(d,'queue.sqlite');writeFileSync(file,'');
 const started=performance.now();
 await assert.rejects(openBookQueue({directory:d}),/Invalid queue state/);
 const elapsed=performance.now()-started;
 assert.ok(elapsed>=4900&&elapsed<12000,`unexpected first-open timeout: ${elapsed}ms`);
 const db=new DatabaseSync(file);
 try{assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get().n,0);}
 finally{db.close();}
});
test('existing nonempty orphan SQLite schema is never repaired during open',async t=>{
 const d=directory(t),file=join(d,'queue.sqlite'),db=new DatabaseSync(file);
 try{db.exec('CREATE TABLE unrelated(value INTEGER NOT NULL); INSERT INTO unrelated VALUES (17)');}
 finally{db.close();}
 await assert.rejects(openBookQueue({directory:d}),/Invalid queue state/);
 const check=new DatabaseSync(file);
 try{
  assert.equal(check.prepare('SELECT value FROM unrelated').get().value,17);
  assert.equal(check.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='queue_metadata'").get().n,0);
 }finally{check.close();}
});

test('stale lease completion cannot overwrite a later owner across reopened handles',async t=>{
 let nowValue=100;const d=directory(t),now=()=>nowValue;
 const first=await openBookQueue({directory:d,now,maxAttempts:3});
 const job=await first.enqueue(input),oldLease=await first.acquire({workerId:'first',leaseMs:10});
 nowValue=110;
 const second=await openBookQueue({directory:d,now,maxAttempts:3});
 const newLease=await second.acquire({workerId:'second',leaseMs:100});
 assert.notEqual(oldLease.token,newLease.token);
 await assert.rejects(first.complete(job.id,oldLease.token,{result:{source:'stale'},metrics:{}}),/Lease rejected/);
 await second.complete(job.id,newLease.token,{result:{source:'current'},metrics:{}});
 assert.equal((await first.get(job.id)).result.source,'current');
});
test('read-only queue operations never trigger full-table job deletion',async t=>{
 const d=directory(t),q=await openBookQueue({directory:d});
 const job=await q.enqueue(input),db=new DatabaseSync(join(d,'queue.sqlite'));
 try{db.exec("CREATE TRIGGER forbid_read_delete BEFORE DELETE ON jobs BEGIN SELECT RAISE(ABORT, 'read attempted delete'); END");}
 finally{db.close();}
 assert.equal((await q.get(job.id)).id,job.id);
 assert.equal((await q.list()).length,1);
 assert.equal((await q.exportSnapshot()).jobs.length,1);
 await assert.rejects(q.enqueue({...input,page:2}),/Invalid queue state/);
 assert.equal((await q.list()).length,1);
});
test('first-open contention never exposes a partially initialized schema to readers',async t=>{
 const d=directory(t),moduleUrl=new URL('../src/book-ingestion/queue.mjs',import.meta.url).href;
 const script=`import {openBookQueue} from ${JSON.stringify(moduleUrl)};const q=await openBookQueue({directory:${JSON.stringify(d)}});const snapshot=await q.exportSnapshot();if(snapshot.schemaVersion!==1||snapshot.jobs.length!==0)process.exit(9);`;
 const processes=Array.from({length:8},()=>promisify(execFile)(process.execPath,['--input-type=module','-e',script],{timeout:15000}));
 const results=await Promise.allSettled(processes);
 assert.equal(results.filter(r=>r.status==='rejected').length,0,JSON.stringify(results.filter(r=>r.status==='rejected').map(r=>String(r.reason))));
 const db=new DatabaseSync(join(d,'queue.sqlite'));
 try{
  assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('queue_metadata','jobs')").get().n,2);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{db.close();}
});
test('independent first-open processes converge on one initialized schema',async t=>{
 const moduleUrl=new URL('../src/book-ingestion/queue.mjs',import.meta.url).href;
 // Separate databases make every round a genuine first-open race, not a warm reopen.
 for(let round=0;round<4;round++){
  const d=directory(t);
  const script=`import {openBookQueue} from ${JSON.stringify(moduleUrl)};const q=await openBookQueue({directory:${JSON.stringify(d)}});console.log(JSON.stringify(await q.exportSnapshot()));`;
  const results=await Promise.all(Array.from({length:8},()=>promisify(execFile)(process.execPath,['--input-type=module','-e',script],{timeout:15000})));
  for(const result of results){const snapshot=JSON.parse(result.stdout.trim());assert.equal(snapshot.schemaVersion,1);assert.equal(snapshot.maxAttempts,3);assert.deepEqual(snapshot.jobs,[]);}
  const db=new DatabaseSync(join(d,'queue.sqlite'));
  try{
   assert.equal(db.prepare('SELECT count(*) AS n FROM queue_metadata').get().n,1);
   assert.equal(db.prepare('SELECT count(*) AS n FROM jobs').get().n,0);
   assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  }finally{db.close();}
 }
});
test('OS lock recovers after killed writer and rolls back interrupted transaction',async t=>{
 const d=directory(t),q=await openBookQueue({directory:d});const job=await q.enqueue(input);
 const script=`import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(${JSON.stringify(join(d,'queue.sqlite'))});db.exec("BEGIN IMMEDIATE;UPDATE jobs SET state='failed'");console.log('locked');setInterval(()=>{},1000);`;
 const child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['ignore','pipe','pipe']});t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL')});
 await once(child.stdout,'data');const exit=once(child,'exit');child.kill('SIGKILL');await exit;
 const reopened=await openBookQueue({directory:d});assert.equal((await reopened.get(job.id)).state,'queued');assert.ok(await reopened.acquire({workerId:'recovered',leaseMs:1000}));
});
test('rejects getters, invalid bounds and prototype metadata without invoking code',async t=>{
 const q=await openBookQueue({directory:directory(t)});let called=false;const bad={...input};Object.defineProperty(bad,'payload',{enumerable:true,get(){called=true;throw Error('private content')}});await assert.rejects(q.enqueue(bad));assert.equal(called,false);
 for(const patch of [{page:0},{sourceHash:'bad'},{payload:{x:Infinity}},{payload:JSON.parse('{"__proto__":{}}')},{payload:{x:undefined}}])await assert.rejects(q.enqueue({...input,...patch}));
 await assert.rejects(q.acquire({workerId:'x',leaseMs:0}));await assert.rejects(q.importSnapshot('{invalid'));
 const opening={};Object.defineProperty(opening,'directory',{get(){called=true;throw Error('private document')}});await assert.rejects(openBookQueue(opening));assert.equal(called,false);
 await assert.rejects(q.enqueue({...input,payload:{chunks:Array(10).fill('x'.repeat(10000))}}));
});
test('expiry at final attempt becomes failed and rejects every late worker mutation',async t=>{
 let time=100;const d=directory(t),q=await openBookQueue({directory:d,now:()=>time,maxAttempts:1});await q.enqueue(input);const j=await q.acquire({workerId:'old',leaseMs:10});time=110;
 for(const action of [()=>q.checkpoint(j.id,j.token,{}),()=>q.fail(j.id,j.token,{code:'TOO_LATE'}),()=>q.complete(j.id,j.token,{result:{},metrics:{}})])await assert.rejects(action(),/Lease rejected/);
 const reopened=await openBookQueue({directory:d,now:()=>time,maxAttempts:1});assert.equal((await reopened.get(j.id)).state,'failed');assert.equal((await reopened.get(j.id)).errorCode,'LEASE_EXPIRED');assert.equal(await reopened.acquire({workerId:'new',leaseMs:10}),null);
});
test('restored active leases are invalidated; invalid snapshots never partially import',async t=>{
 const a=await openBookQueue({directory:directory(t)});await a.enqueue(input);const leased=await a.acquire({workerId:'old',leaseMs:10000});const snapshot=await a.exportSnapshot();
 const b=await openBookQueue({directory:directory(t)});const corrupt=structuredClone(snapshot);corrupt.jobs[0].id='b'.repeat(64);await assert.rejects(b.importSnapshot(corrupt));assert.deepEqual(await b.list(),[]);
 await b.importSnapshot(snapshot);await assert.rejects(b.complete(leased.id,leased.token,{result:{},metrics:{}}));const fresh=await b.acquire({workerId:'new',leaseMs:10000});assert.notEqual(fresh.token,leased.token);assert.equal(fresh.attempts,2);
});
test('deleted metadata and malformed stored JSON fail closed without silent repair',async t=>{
 const d=directory(t);const q=await openBookQueue({directory:d});await q.enqueue(input);const db=new DatabaseSync(join(d,'queue.sqlite'));db.exec('DELETE FROM queue_metadata');db.close();await assert.rejects(openBookQueue({directory:d}),/Invalid queue state/);
 const e=directory(t),other=await openBookQueue({directory:e});await other.enqueue(input);const broken=new DatabaseSync(join(e,'queue.sqlite'));broken.exec("UPDATE jobs SET payload='{broken'");broken.close();await assert.rejects(other.list(),/Invalid queue state/);
});
test('nonsymlink storage paths enforced',async t=>{
 const d=directory(t),target=directory(t);const link=join(d,'linked');try{symlinkSync(target,link,process.platform==='win32'?'junction':'dir');}catch(e){if(e.code==='EPERM'){t.skip('symlink privileges unavailable');return;}throw e;}
 await assert.rejects(openBookQueue({directory:link}),/Invalid queue directory/);
});
test('review receipt persistence is digest-pinned, immutable and idempotent',async t=>{
 const q=await openBookQueue({directory:directory(t)}),j=await q.enqueue(input),digest='c'.repeat(64);
 const receipt={candidateDigest:digest,decision:'approved',reviewer:'Synthetic reviewer',reason:'Source checked',reviewedAt:'2026-10-15T00:00:00.000Z',visualVerified:true};
 await assert.rejects(q.recordReview(j.id,receipt));const lease=await q.acquire({workerId:'x',leaseMs:10000});await q.complete(j.id,lease.token,{result:{digest},metrics:Object.fromEntries(Array.from({length:30},(_,i)=>['metric'+i,i]))});
 for(const patch of [{candidateDigest:'d'.repeat(64)},{reviewedAt:'2026-02-30T00:00:00.000Z'},{reviewer:''},{decision:'proven'},{visualVerified:'true'},{reason:'x'.repeat(1001)},{extra:true}])await assert.rejects(q.recordReview(j.id,{...receipt,...patch}));
 const reviewed=await q.recordReview(j.id,receipt);assert.deepEqual(reviewed.result.reviewReceipt,receipt);assert.equal(reviewed.metrics.reviewDecisions,1);
 const reordered=Object.fromEntries(Object.entries(receipt).reverse());assert.deepEqual(await q.recordReview(j.id,reordered),reviewed);
 await assert.rejects(q.recordReview(j.id,{...receipt,decision:'rejected'}));assert.equal((await q.get(j.id)).metrics.reviewDecisions,1);
 const restored=await openBookQueue({directory:directory(t)});await restored.importSnapshot(await q.exportSnapshot());assert.deepEqual((await restored.get(j.id)).result.reviewReceipt,receipt);
});
test('targeted acquire leases only the requested queued job atomically',async t=>{
 const d=directory(t),a=await openBookQueue({directory:d}),b=await openBookQueue({directory:d});const first=await a.enqueue(input),second=await a.enqueue({...input,page:2});
 assert.equal(await a.acquire({workerId:'x',leaseMs:10000,jobId:'f'.repeat(64)}),null);assert.equal((await a.get(first.id)).attempts,0);assert.equal((await a.get(second.id)).attempts,0);
 await assert.rejects(a.acquire({workerId:'x',leaseMs:10000,jobId:'invalid'}));
 const [j,none]=await Promise.all([a.acquire({workerId:'x',leaseMs:10000,jobId:second.id}),b.acquire({workerId:'y',leaseMs:10000,jobId:second.id})]);assert.equal(j.id,second.id);assert.equal(none,null);assert.equal((await a.get(first.id)).state,'queued');
 await a.complete(j.id,j.token,{result:{},metrics:{}});assert.equal(await a.acquire({workerId:'x',leaseMs:10000,jobId:second.id}),null);assert.equal((await a.acquire({workerId:'x',leaseMs:10000})).id,first.id);
});
