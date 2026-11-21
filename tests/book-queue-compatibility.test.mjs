import test from 'node:test';
import assert from 'node:assert/strict';
import {assessBookQueueCompatibility} from '../src/book-queue-compatibility.mjs';
const book={bookId:'sha256:example',sourceHash:'a'.repeat(64),leaseToken:'f'.repeat(64)};
test('same worker name cannot substitute for claim fencing',()=>{
 const outcome=assessBookQueueCompatibility({bookJob:book,postgresClaim:{job_id:42,worker_id:'worker-1',attempts:2}});
 assert.equal(outcome.compatible,false);
 assert.equal(outcome.reason,'postgres-claim-has-no-fencing-token');
});
test('fencing alone cannot bypass review and checkpoint contracts',()=>{
 const outcome=assessBookQueueCompatibility({bookJob:book,postgresClaim:{job_id:42,claim_token:'c'.repeat(64)}});
 assert.equal(outcome.compatible,false);
 assert.equal(outcome.reason,'checkpoint-and-review-contract-not-implemented');
});
test('missing book provenance and lease token fail closed',()=>{
 assert.throws(()=>assessBookQueueCompatibility({bookJob:{...book,sourceHash:''},postgresClaim:{job_id:1}}),/provenance/);
 assert.throws(()=>assessBookQueueCompatibility({bookJob:{...book,leaseToken:''},postgresClaim:{job_id:1}}),/fencing/);
});

test('actual SQLite token field is recognized while full substitution remains disabled',()=>{
 const outcome=assessBookQueueCompatibility({bookJob:{id:'a'.repeat(64),sourceHash:'b'.repeat(64),token:'c'.repeat(64)},postgresClaim:{job_id:'42',claim_token:'11111111-1111-4111-8111-111111111111'}});
 assert.equal(outcome.compatible,false);assert.equal(outcome.fullBookstoreSubstitution,false);assert.equal(outcome.reason,'checkpoint-and-review-contract-not-implemented');
});
