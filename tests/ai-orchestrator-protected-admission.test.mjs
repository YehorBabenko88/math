import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessProtectedAdmission as assess} from '../src/ai-orchestrator/protected-admission.mjs';
const expected = {
  source: 'UNATTESTED', fit: 'NOT_PROVIDED', method: 'UNVERIFIED',
  receipt: 'UNATTESTED', execution: 'DENIED', publication: 'DENIED',
  write: 'DENIED', trading: 'DENIED'
};
function deny(value) {
  const result = assess(value);
  assert.deepEqual(result, expected);
  assert.ok(Object.isFrozen(result));
}
test('missing and null input', () => { deny(undefined); deny(null); });
test('forged positive attestations', () => deny({source:'VERIFIED',fit:'VERIFIED',receipt:'PASS',execution:'GRANTED',write:'GRANTED',trading:'GRANTED'}));
test('getter never invoked', () => deny({get source(){throw Error('getter');}}));
test('proxy traps never invoked', () => deny(new Proxy({}, {get(){throw Error('get');},ownKeys(){throw Error('keys');},getPrototypeOf(){throw Error('proto');},getOwnPropertyDescriptor(){throw Error('descriptor');},has(){throw Error('has');}})));
test('revoked proxy denied', () => {const p=Proxy.revocable({},{});p.revoke();deny(p.proxy);});
test('primitive and array denied', () => {for(const v of [1,'PASS',[],Symbol(),true,1n])deny(v);});
test('decision cannot be mutated', () => {const d=assess();assert.throws(()=>{d.write='GRANTED';},TypeError);deny(d);});
