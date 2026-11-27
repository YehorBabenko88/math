import test from 'node:test';
import assert from 'node:assert/strict';
import {enumerateDiscovery} from '../src/discovery-search.mjs';
import {semanticDigest} from '../src/math-universe-codec.mjs';
const id = n => n.toString(16).padStart(64,'0');
const req = () => ({schema:'math.discovery.request.v1',developmentRef:id(1),
  policyRef:id(2),catalogRef:id(3),methodRefs:[id(5),id(4)],
  portStateRefs:[id(7),id(6)],maxIntents:4});
test('Cartesian ASCII order, ordinal and exact inert schema', () => {
  const r=req(), out=enumerateDiscovery(r);
  assert.deepEqual(out.map(x=>[x.methodRef,x.portStateRef,x.ordinal]),[
    [id(4),id(6),0],[id(4),id(7),1],[id(5),id(6),2],[id(5),id(7),3]]);
  assert.deepEqual(out[0],{schema:'math.discovery.intent.v1',developmentRef:id(1),
    policyRef:id(2),catalogRef:id(3),methodRef:id(4),portStateRef:id(6),
    ordinal:0,status:'UNREGISTERED'});
  assert.ok(Object.isFrozen(out) && out.every(Object.isFrozen));
});
test('permutation invariance and shared external semantic identity', () => {
  const r=req(), a=enumerateDiscovery(r);
  r.methodRefs.reverse();r.portStateRefs.reverse();
  const b=enumerateDiscovery(r);
  assert.deepEqual(a,b);
  const ids=a.map(x=>semanticDigest(x.schema,x));
  assert.equal(new Set(ids).size,4);
  assert.deepEqual(ids,b.map(x=>semanticDigest(x.schema,x)));
});
test('empty and exact cap; no truncation', () => {
  assert.deepEqual(enumerateDiscovery({...req(),methodRefs:[]}),[]);
  const r={...req(),methodRefs:Array.from({length:10},(_,i)=>id(i)),
    portStateRefs:Array.from({length:100},(_,i)=>id(i)),maxIntents:1000};
  assert.equal(enumerateDiscovery(r).length,1000);
  assert.throws(()=>enumerateDiscovery({...r,maxIntents:999}),/DISCOVERY_BUDGET_EXCEEDED/);
});
