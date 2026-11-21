import test from 'node:test';
import assert from 'node:assert/strict';
import {bookPostgresJSONCompatible,BOOK_POSTGRES_BLOCKERS,BOOK_POSTGRES_JSON_PARITY} from '../src/book-ingestion/postgres-json.mjs';
test('PostgreSQL wire supports native text while operational cutover prerequisites remain blocked',()=>{
 for(const data of [{text:'a\0b'},{text:'\ud800'},{text:'\udfff'},{['bad\0key']:1}])assert.equal(bookPostgresJSONCompatible(data),true);
 assert.equal(bookPostgresJSONCompatible({text:'Math ∑ 😀 \n'}),true);
 assert.equal(BOOK_POSTGRES_JSON_PARITY,true);
 assert.deepEqual(BOOK_POSTGRES_BLOCKERS,['operator-cutover-prerequisites']);
});
