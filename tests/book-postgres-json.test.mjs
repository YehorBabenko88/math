import test from 'node:test';
import assert from 'node:assert/strict';
import {bookPostgresJSONCompatible,BOOK_POSTGRES_BLOCKERS} from '../src/book-ingestion/postgres-json.mjs';
test('PostgreSQL JSON compatibility detects lossless-storage blockers in values and keys',()=>{
 for(const data of [{text:'a\0b'},{text:'\ud800'},{text:'\udfff'},{['bad\0key']:1}])assert.equal(bookPostgresJSONCompatible(data),false);
 assert.equal(bookPostgresJSONCompatible({text:'Math ∑ 😀 \n'}),true);
 assert.deepEqual(BOOK_POSTGRES_BLOCKERS,['native-json-text-parity']);
});
