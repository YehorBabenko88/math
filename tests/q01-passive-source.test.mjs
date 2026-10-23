import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const module=await import('../scripts/q01-lab/passive-source.mjs').catch(()=>({}));
test('passive diagnostic transformation binds exact production bytes and leaves native imports',()=>{
 assert.equal(typeof module.instrumentQueue,'function');const original=readFileSync(new URL('../src/book-ingestion/queue.mjs',import.meta.url),'utf8');const changed=module.instrumentQueue(original);
 assert.match(changed,/from 'node:sqlite'/);assert.match(changed,/from 'node:fs'/);assert.match(changed,/unsafe-storage/);assert.match(changed,/constructor-error/);assert.match(changed,/directory-error/);assert.match(changed,/transaction-error/);assert.match(changed,/close-error/);
 assert.throws(()=>module.instrumentQueue(original+'\n'));
});
test('passive source accepts byte buffers and typed arrays without weakening the hash pin',()=>{
 const original=readFileSync(new URL('../src/book-ingestion/queue.mjs',import.meta.url));
 assert.equal(module.instrumentQueue(original),module.instrumentQueue(new Uint8Array(original)));
});
test('error-only diagnostic copy retains native imports with explicit pinned dependencies',()=>{
 const original=readFileSync(new URL('../src/book-ingestion/queue.mjs',import.meta.url));
 const url=module.diagnosticQueueURL(original,'file:///synthetic/queue-contract.mjs','file:///synthetic/sqlite-text.mjs');
 const decoded=Buffer.from(url.split(',')[1],'base64').toString();
 assert.match(decoded,/from 'node:sqlite'/);assert.match(decoded,/file:\/\/\/synthetic\/queue-contract.mjs/);assert.doesNotMatch(decoded,/from '\.\/queue-contract.mjs'/);
 assert.throws(()=>module.diagnosticQueueURL(original,'https://example.invalid/a','file:///b'));
});
