import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';

test('Q01: existing empty SQLite database is never silently adopted',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'q01-existing-empty-'));
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const db=new DatabaseSync(join(directory,'queue.sqlite'));
 db.close();
 await assert.rejects(openBookQueue({directory}),/Invalid queue state/);
});

test('Q01: pre-existing partial schema fails closed without mutation',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'q01-partial-schema-'));
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const db=new DatabaseSync(join(directory,'queue.sqlite'));
 db.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY)');
 db.close();
 await assert.rejects(openBookQueue({directory}),/Invalid queue state/);
 const check=new DatabaseSync(join(directory,'queue.sqlite'),{readOnly:true});
 try{
  assert.equal(check.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='unrelated'").get().n,1);
  assert.equal(check.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='queue_metadata'").get().n,0);
 }finally{check.close();}
});
