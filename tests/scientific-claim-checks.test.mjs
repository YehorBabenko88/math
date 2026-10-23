import test from 'node:test';
import assert from 'node:assert/strict';
import {assessScientificClaim} from '../src/scientific-claim-checks.mjs';
const base={claim:'Point distance is the Euclidean norm',referenceId:'filchakov-1973',locator:'printed p. 10'};
test('unverified claims stay untested without observations',()=>{assert.equal(assessScientificClaim(base).status,'untested')});
test('numerical evidence may reproduce a bounded claim',()=>{const r=assessScientificClaim({...base,observations:[{expected:5,actual:Math.hypot(3,4)}]});assert.equal(r.status,'reproduced');assert.equal(r.scope,'numeric-check-only')});
test('mismatched results contradict tested example',()=>{assert.equal(assessScientificClaim({...base,observations:[{expected:5,actual:6}]}).status,'contradicted')});
test('rejects nonfinite observations and missing provenance',()=>{assert.throws(()=>assessScientificClaim({...base,observations:[{expected:NaN,actual:5}]}));assert.throws(()=>assessScientificClaim({...base,locator:''}))});
