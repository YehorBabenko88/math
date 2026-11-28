import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOrchestratorEvidence as assess} from '../src/ai-orchestrator/trust-gate.mjs';
const evidence=()=>({source:{},receipt:{},runner:{},kernel:{}});
const denied={source:'UNRESOLVED',receipt:'UNATTESTED',runner:'UNATTESTED',kernel:'NOT_INDEPENDENTLY_VERIFIED',publication:'DENIED'};
const invalid=x=>assert.throws(()=>assess(x),{message:'INVALID_EVIDENCE'});
for(const trap of ['getPrototypeOf','ownKeys','getOwnPropertyDescriptor']) test(`reject proxy without ${trap}`,()=>{
 let hits=0;const p=new Proxy(evidence(),{[trap](...args){hits++;return Reflect[trap](...args);}});
 invalid(p);assert.equal(hits,0);
});
test('reject revoked proxy with stable error',()=>{const {proxy,revoke}=Proxy.revocable(evidence(),{});revoke();invalid(proxy);});
test('reject array proxy without traps',()=>{let hits=0;invalid(new Proxy([],{getPrototypeOf(){hits++;throw Error('trap');}}));assert.equal(hits,0);});
test('reject accessor without calling it',()=>{let hits=0;const x=evidence();Object.defineProperty(x,'source',{get(){hits++;return {};}});invalid(x);assert.equal(hits,0);});
test('preserve frozen deny-only ABI and ignore nested proxies',()=>{let hits=0;const x=evidence();x.source=new Proxy({publication:'APPROVED'},{get(){hits++;throw Error('trap');}});const r=assess(x);assert.deepEqual(r,denied);assert.ok(Object.isFrozen(r));assert.equal(hits,0);});
test('preserve invalid shape refusals',()=>{for(const x of [null,[],{},Object.create(null),{...evidence(),approved:true}])invalid(x);});
