import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const queue=readFileSync(new URL('../src/book-ingestion/queue.mjs',import.meta.url),'utf8');

test('Q01 retry sentinel reaches outer bounded retry handler',()=>{
 const catchStart=queue.indexOf('}catch(e){if(db)');
 const outerStart=queue.indexOf('const initializationDeadline=');
 assert.ok(catchStart>=0&&outerStart>catchStart);
 const inner=queue.slice(catchStart,outerStart);
 assert.match(inner,/if\(initialize&&e\.code==='BOOK_QUEUE_INITIALIZING'\)throw e;/);
 assert.match(queue.slice(outerStart),/if\(error\.code!=='BOOK_QUEUE_INITIALIZING'\)throw error;/);
 assert.match(queue.slice(outerStart),/performance\.now\(\)>=initializationDeadline/);
});

test('Q01 internal retry sentinel is not accepted for normal queue mutations',()=>{
 const catchStart=queue.indexOf('}catch(e){if(db)');
 const outerStart=queue.indexOf('const initializationDeadline=');
 const inner=queue.slice(catchStart,outerStart);
 assert.doesNotMatch(inner,/if\(e\.code==='BOOK_QUEUE_INITIALIZING'\)throw e;/);
 assert.match(inner,/if\(initialize&&e\.code==='BOOK_QUEUE_INITIALIZING'\)throw e;/);
});
