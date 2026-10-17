import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBookQueue} from '../src/book-ingestion/queue.mjs';
import {DatabaseSync} from 'node:sqlite';
import {encodeSQLiteText,decodeSQLiteText} from '../src/book-ingestion/sqlite-text.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('SQLite TEXT metadata preserves lone UTF16 without breaking source identity on reopen',async t=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'sqlite-text-')));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const q=await openBookQueue({directory,now:()=>100});
 const input={sourceHash:'a'.repeat(64),edition:'e\ud800\0',page:1,extractionVersion:'x\udfff',payload:{}};
 const j=await q.enqueue(input),reopened=await openBookQueue({directory,now:()=>100});
 assert.deepEqual(await reopened.get(j.id),j);
 const lease=await reopened.acquire({workerId:'w\ud800',leaseMs:100});
 assert.deepEqual(await reopened.get(j.id),lease);assert.equal(lease.workerId,'w\ud800');
});
test('SQLite text framing preserves legacy literals and rejects corrupt/future blobs',()=>{
 const legacy='book-sqlite-text/v1\n"literal"';assert.equal(decodeSQLiteText(legacy),legacy);assert.equal(encodeSQLiteText(legacy),legacy);
 assert.equal(decodeSQLiteText(encodeSQLiteText('x\ud800\0')),'x\ud800\0');
 for(const blob of [Buffer.from('book-sqlite-text/v2\n"\\ud800"'),Buffer.from('book-sqlite-text/v1\n"well formed"'),Buffer.from('book-sqlite-text/v1\n{}'),Buffer.from([255]),Buffer.alloc(8193)])assert.throws(()=>decodeSQLiteText(blob));
});
test('corrupt SQLite metadata BLOB fails closed without repairing storage',async t=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'sqlite-text-corrupt-')));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const q=await openBookQueue({directory,now:()=>100});await q.enqueue({sourceHash:'a'.repeat(64),edition:'e\ud800',page:1,extractionVersion:'v1',payload:{}});
 const db=new DatabaseSync(join(directory,'queue.sqlite')),bad=Buffer.from('book-sqlite-text/v99\n"\\ud800"');db.prepare('UPDATE jobs SET edition=?').run(bad);db.close();
 await assert.rejects(q.list(),/Invalid queue state/);
 const read=new DatabaseSync(join(directory,'queue.sqlite'));try{assert.deepEqual(Buffer.from(read.prepare('SELECT edition FROM jobs').get().edition),bad)}finally{read.close()}
});
test('concurrent SQLite opener waits for the creator instead of declaring its empty file corrupt',async t=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'sqlite-init-race-')));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const wrapper=`import {DatabaseSync as Native} from 'node:sqlite';let paused=false;export function DatabaseSync(...args){const db=new Native(...args);if(!paused){paused=true;console.log('FILE_CREATED');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500)}return db;}`;
 const source=`import {registerHooks} from 'node:module';const wrapper=${JSON.stringify('data:text/javascript,'+encodeURIComponent(wrapper))};registerHooks({resolve(specifier,context,next){if(specifier==='node:sqlite'&&context.parentURL!==wrapper)return {url:wrapper,shortCircuit:true};return next(specifier,context)}});const {openBookQueue}=await import(${JSON.stringify(new URL('../src/book-ingestion/queue.mjs',import.meta.url).href)});await openBookQueue({directory:${JSON.stringify(directory)}});`;
 const child=spawn(process.execPath,['--input-type=module','--eval',source],{windowsHide:true,stdio:['ignore','pipe','pipe']});const exited=once(child,'exit');let timer;
 try{
  await new Promise((resolve,reject)=>{let data='';timer=setTimeout(()=>reject(Error('Creator deadline')),10000);child.stdout.on('data',part=>{data+=part;if(data.includes('FILE_CREATED'))resolve()});child.once('error',reject);child.once('exit',()=>reject(Error('Creator exited early')))});clearTimeout(timer);
  const queue=await openBookQueue({directory});assert.deepEqual(await queue.list(),[]);const [code]=await exited;assert.equal(code,0);
 }finally{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited}}
});
test('orphan empty SQLite file is not silently initialized or repaired',async t=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'sqlite-empty-orphan-')));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const file=join(directory,'queue.sqlite');writeFileSync(file,Buffer.alloc(0));
 await assert.rejects(openBookQueue({directory}),/Invalid queue state/);assert.equal(readFileSync(file).length,0);
});
