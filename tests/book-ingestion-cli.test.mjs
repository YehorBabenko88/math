import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
import {runBookIngestion} from '../scripts/book-ingestion.mjs';
test('queue CLI lists redacted metadata, writes exclusive backup and restores idempotency',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'book-cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));const qdir=join(dir,'q'),queue=await openBookQueue({directory:qdir});
 const entry={sourceHash:'a'.repeat(64),edition:'Private edition',page:1,extractionVersion:'1',payload:{privateDocument:'PRIVATE_SOURCE_TEXT',apiKey:'NOT_A_REAL_KEY'}};const job=await queue.enqueue(entry);
 let log='';const stdout={write:s=>{log+=s}};
 const list=await runBookIngestion(['list','--queue',qdir],{stdout});assert.equal(list[0].id,job.id);assert.equal(log.includes('PRIVATE_SOURCE_TEXT'),false);assert.equal(log.includes('NOT_A_REAL_KEY'),false);
 const backup=join(dir,'backup.json');await runBookIngestion(['backup','--queue',qdir,'--output',backup],{stdout});const original=await readFile(backup,'utf8');
 await assert.rejects(runBookIngestion(['backup','--queue',qdir,'--output',backup],{stdout}),/EEXIST/);assert.equal(await readFile(backup,'utf8'),original);
 const restored=join(dir,'restored');await runBookIngestion(['restore','--queue',restored,'--response',backup],{stdout});assert.equal((await (await openBookQueue({directory:restored})).enqueue(entry)).id,job.id);
 await assert.rejects(runBookIngestion(['run-one','--queue',qdir,'--python','python','--response',backup,'--worker','user'],{stdout}),/Required/);
 await assert.rejects(runBookIngestion(['list','--queue',qdir,'--unknown','secret'],{stdout}),/Invalid/);
});
