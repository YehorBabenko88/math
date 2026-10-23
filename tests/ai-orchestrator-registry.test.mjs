import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openReceiptRegistry} from '../src/ai-orchestrator/registry.mjs';
const h='a'.repeat(64),b='b'.repeat(64);
test('durable duplicate rejected after reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ai-receipts-')),file=join(dir,'registry.sqlite');
 try{
  let r=openReceiptRegistry(file);
  assert.equal(r.register({taskId:'job1',attempt:1,receiptHash:h}).status,'REGISTERED_UNATTESTED');
  r.close();
  r=openReceiptRegistry(file);
  assert.throws(()=>r.register({taskId:'job1',attempt:1,receiptHash:b}),/REPLAY_DETECTED/);
  assert.equal(r.register({taskId:'job1',attempt:2,receiptHash:b}).attempt,2);
  r.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('two connections cannot register same attempt',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ai-receipts-')),file=join(dir,'registry.sqlite');
 let a,c;
 try{
  a=openReceiptRegistry(file);c=openReceiptRegistry(file);
  a.register({taskId:'job1',attempt:1,receiptHash:h});
  assert.throws(()=>c.register({taskId:'job1',attempt:1,receiptHash:h}),/REPLAY_DETECTED/);
 }finally{a?.close();c?.close();rmSync(dir,{recursive:true,force:true});}
});
test('invalid registrations rejected',()=>{
 const r=openReceiptRegistry(':memory:');
 try{assert.throws(()=>r.register({taskId:'../bad',attempt:1,receiptHash:h}),/INVALID_REGISTRATION/);}
 finally{r.close();}
});

test('reject pre-existing incompatible table without unique key',async()=>{
 const {DatabaseSync}=await import('node:sqlite');
 const dir=mkdtempSync(join(tmpdir(),'ai-receipts-')),file=join(dir,'registry.sqlite');
 try{
  const db=new DatabaseSync(file);
  db.exec('CREATE TABLE ai_receipt_registry(task_id TEXT,attempt INTEGER,receipt_hash TEXT)');
  db.close();
  assert.throws(()=>openReceiptRegistry(file),/INVALID_REGISTRY_SCHEMA/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('reject extra column even if composite primary key exists',async()=>{
 const {DatabaseSync}=await import('node:sqlite');
 const dir=mkdtempSync(join(tmpdir(),'ai-receipts-')),file=join(dir,'registry.sqlite');
 try{
  const db=new DatabaseSync(file);
  db.exec('CREATE TABLE ai_receipt_registry(task_id TEXT NOT NULL,attempt INTEGER NOT NULL,receipt_hash TEXT NOT NULL, unexpected TEXT, PRIMARY KEY(task_id,attempt))');
  db.close();
  assert.throws(()=>openReceiptRegistry(file),/INVALID_REGISTRY_SCHEMA/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('reject trigger that could silently modify receipt registrations',async()=>{
 const {DatabaseSync}=await import('node:sqlite');
 const dir=mkdtempSync(join(tmpdir(),'ai-receipts-')),file=join(dir,'registry.sqlite');
 try{
  const db=new DatabaseSync(file);
  db.exec(`CREATE TABLE ai_receipt_registry(task_id TEXT NOT NULL,attempt INTEGER NOT NULL CHECK(attempt BETWEEN 1 AND 2),receipt_hash TEXT NOT NULL CHECK(length(receipt_hash)=64),PRIMARY KEY(task_id,attempt));
CREATE TRIGGER receipt_drop AFTER INSERT ON ai_receipt_registry BEGIN DELETE FROM ai_receipt_registry; END;`);
  db.close();
  assert.throws(()=>openReceiptRegistry(file),/INVALID_REGISTRY_SCHEMA/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('repeated first-open on same database preserves unique registration',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ai-receipts-')),file=join(dir,'registry.sqlite');
 let a,b;
 try{
  a=openReceiptRegistry(file);b=openReceiptRegistry(file);
  a.register({taskId:'job1',attempt:1,receiptHash:h});
  assert.throws(()=>b.register({taskId:'job1',attempt:1,receiptHash:h}),/REPLAY_DETECTED/);
 }finally{a?.close();b?.close();rmSync(dir,{recursive:true,force:true});}
});
