import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const runId='67f524fc-8c53-4a21-8d7d-b175cdfb938d',configHash='a'.repeat(64);
const proof={actorHash:'b'.repeat(64),sessionHash:'c'.repeat(64),expiresAt:100000};
async function setup(t){const {openCutoverJournal}=await import('../src/book-ingestion/cutover-journal.mjs');const directory=realpathSync(mkdtempSync(join(tmpdir(),'book-journal-')));let time=1000;const options={directory,runId,configHash,now:()=>time,leaseMs:100};const journals=[];const open=()=>{const j=openCutoverJournal(options);journals.push(j);return j;};t.after(()=>{for(const j of journals)j.close();rmSync(directory,{recursive:true,force:true});});return {open,options,tick:n=>{time=n;}};}
test('durable claims fence concurrent and crashed owners and accumulate evidence',async t=>{const f=await setup(t),a=f.open();assert.equal(a.prepare(proof).state,'PREPARE');assert.equal(a.prepare(proof).generation,0);const first=a.claim(proof),b=f.open();assert.throws(()=>b.claim(proof));f.tick(1100);const second=b.claim(proof);assert.equal(second.generation,2);assert.throws(()=>a.commit(first,'QUIESCE',{x:1},proof));b.commit(second,'QUIESCE',{sourceHash:'d'.repeat(64)},proof);assert.equal(a.status().state,'QUIESCE');const next=a.claim(proof);a.commit(next,'BACKUP',{backupHash:'e'.repeat(64)},proof);assert.equal(b.status().evidence.sourceHash,'d'.repeat(64));assert.equal(b.status().evidence.backupHash,'e'.repeat(64));assert.equal(JSON.stringify(b.status()).includes(next.token),false);assert.throws(()=>a.commit(next,'TRANSFER',{},proof));});
test('binds directory to one run/config and rejects invalid transitions and expired leases',async t=>{const f=await setup(t),a=f.open();a.prepare(proof);const claim=a.claim(proof);assert.throws(()=>a.commit(claim,'READY',{},proof));f.tick(1100);assert.throws(()=>a.fail(claim,proof));const b=f.open(),fresh=b.claim(proof);b.fail(fresh,proof);assert.equal(a.status().state,'FAILED');assert.throws(()=>a.claim(proof));const {openCutoverJournal}=await import('../src/book-ingestion/cutover-journal.mjs');assert.throws(()=>openCutoverJournal({...f.options,configHash:'f'.repeat(64)}));});
test('checks event chain against storage tampering before reads or mutations',async t=>{const f=await setup(t),a=f.open();a.prepare(proof);const db=new DatabaseSync(join(f.options.directory,'cutover.sqlite'));try{db.prepare("UPDATE cutover_events SET hash=? WHERE sequence=1").run('f'.repeat(64));}finally{db.close();}assert.throws(()=>a.status());assert.throws(()=>a.claim(proof));});
test('clock rollback cannot resurrect an expired journal owner',async t=>{
 const f=await setup(t),a=f.open();a.prepare(proof);const claim=a.claim(proof);
 f.tick(1100);assert.throws(()=>a.commit(claim,'QUIESCE',{},proof));
 f.tick(1000);assert.throws(()=>a.commit(claim,'QUIESCE',{},proof));
});
test('a large event cannot commit an unreadable journal',async t=>{
 const f=await setup(t),a=f.open();a.prepare(proof);const claim=a.claim(proof);
 assert.throws(()=>a.commit(claim,'QUIESCE',{padding:'x'.repeat(261800)},proof));
 assert.equal(a.status().state,'PREPARE');a.commit(claim,'QUIESCE',{small:true},proof);assert.equal(a.status().state,'QUIESCE');
});
test('existing orphaned storage is not silently initialized as a fresh journal',async t=>{
 const f=await setup(t);const db=new DatabaseSync(join(f.options.directory,'cutover.sqlite'));db.exec('CREATE TABLE unrelated(id INTEGER)');db.close();
 const {openCutoverJournal}=await import('../src/book-ingestion/cutover-journal.mjs');let opened;
 try{assert.throws(()=>{opened=openCutoverJournal(f.options);});}finally{opened?.close();}
 const check=new DatabaseSync(join(f.options.directory,'cutover.sqlite'));try{assert.equal(check.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='cutover_events'").get().n,0);}finally{check.close();}
});
test('an opened journal refuses newly hardlinked storage',async t=>{
 const {linkSync,unlinkSync}=await import('node:fs');const f=await setup(t),a=f.open();a.prepare(proof);
 const alias=join(f.options.directory,'journal-alias');linkSync(join(f.options.directory,'cutover.sqlite'),alias);
 try{assert.throws(()=>a.status());assert.throws(()=>a.claim(proof));}finally{unlinkSync(alias);}
 assert.equal(a.status().state,'PREPARE');
});
test('expected-state CAS rejects a stale claim without consuming a generation',async t=>{
 const f=await setup(t),a=f.open();a.prepare(proof);const claim=a.claim(proof,{expectedState:'PREPARE'});a.commit(claim,'QUIESCE',{},proof);
 assert.throws(()=>a.claim(proof,{expectedState:'PREPARE'}));assert.equal(a.status().generation,1);
 const next=a.claim(proof,{expectedState:'QUIESCE'});assert.equal(next.generation,2);
});
test('capacity exhaustion rejects append while retaining a readable durable journal',{timeout:60000},async t=>{
 const f=await setup(t),a=f.open();a.prepare(proof);const claim=a.claim(proof);a.commit(claim,'QUIESCE',{blob:'x'.repeat(230000)},proof);
 let rejected=false;for(let i=1;i<=200;i++){f.tick(1000+i*101);try{a.claim(proof);}catch{rejected=true;break;}}
 assert.equal(rejected,true);assert.equal(a.status().state,'QUIESCE');assert.equal(f.open().status().state,'QUIESCE');
});
