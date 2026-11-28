import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOrchestratorEvidence as assess} from '../src/ai-orchestrator/trust-gate.mjs';
const deny={source:'UNRESOLVED',receipt:'UNATTESTED',runner:'UNATTESTED',kernel:'NOT_INDEPENDENTLY_VERIFIED',publication:'DENIED'};
const evidence=()=>({source:null,receipt:null,runner:null,kernel:null});
function trapper(){let calls=0;return {handler:new Proxy({}, {get(){calls++;throw Error('TRAP');}}),calls:()=>calls};}
test('nested revoked proxy values are ignored without inspection',()=>{const p=Proxy.revocable({},{});p.revoke();const e=evidence();for(const k of Object.keys(e))e[k]=p.proxy;assert.deepEqual(assess(e),deny);});
test('nested hostile proxy values are inert and output frozen',()=>{const t=trapper();const e=evidence();for(const k of Object.keys(e))e[k]=new Proxy({},t.handler);const result=assess(e);assert.deepEqual(result,deny);assert.equal(t.calls(),0);assert.ok(Object.isFrozen(result));});
test('outer callable and array proxies rejected without trap lookup',()=>{for(const target of [()=>{},[]]){const t=trapper();assert.throws(()=>assess(new Proxy(target,t.handler)),/^Error: INVALID_EVIDENCE$/);assert.equal(t.calls(),0);}});
test('revoked outer proxy rejects with canonical error',()=>{const p=Proxy.revocable(evidence(),{});p.revoke();assert.throws(()=>assess(p.proxy),/^Error: INVALID_EVIDENCE$/);});
test('symbol property cannot masquerade as required key',()=>{const e=evidence();delete e.kernel;e[Symbol('kernel')]=null;assert.throws(()=>assess(e),/^Error: INVALID_EVIDENCE$/);});
