import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDiscoveryRequest} from '../src/discovery-contract.mjs';
const id = n => n.toString(16).padStart(64,'0');
const req = () => ({schema:'math.discovery.request.v1',developmentRef:id(1),
  policyRef:id(2),catalogRef:id(3),methodRefs:[id(5),id(4)],
  portStateRefs:[id(7),id(6)],maxIntents:4});
test('detached sorted immutable request, null prototype accepted', () => {
  const r = Object.assign(Object.create(null),req());
  const v = validateDiscoveryRequest(r);
  r.methodRefs[0] = id(99);
  assert.deepEqual(v.methodRefs,[id(4),id(5)]);
  assert.ok(Object.isFrozen(v) && Object.isFrozen(v.methodRefs));
});
test('closed schema and unique canonical refs', () => {
  for (const patch of [{holdoutRef:id(1)},{methodRefs:[id(1),id(1)]},
    {catalogRef:'A'.repeat(64)},{maxIntents:0},{maxIntents:1001},{maxIntents:1.5},
    {portStateRefs:Array.from({length:257},(_,i)=>id(i))}])
    assert.throws(()=>validateDiscoveryRequest({...req(),...patch}));
});
test('no getters proxies or cycles invoked', () => {
  let touched=0;
  const r=req();
  Object.defineProperty(r,'catalogRef',{enumerable:true,get(){touched++;return id(3);}});
  assert.throws(()=>validateDiscoveryRequest(r));
  assert.throws(()=>validateDiscoveryRequest(new Proxy(req(),{ownKeys(){touched++;return [];}})));
  const c=req();c.methodRefs.push(c);
  assert.throws(()=>validateDiscoveryRequest(c));
  assert.equal(touched,0);
});
test('budget atomic refusal', () => {
  assert.throws(()=>validateDiscoveryRequest({...req(),maxIntents:3}),/DISCOVERY_BUDGET_EXCEEDED/);
});
