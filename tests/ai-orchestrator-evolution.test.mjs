import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectEvolution} from '../src/ai-orchestrator/evolution/eligibility.mjs';
import {checkLineage} from '../src/ai-orchestrator/evolution/lineage.mjs';
const a='a'.repeat(64), b='b'.repeat(64);
const denied={status:'DENIED',execution_authority:false};
const match={status:'BINDING_MATCH_ONLY',execution_authority:false};
for(const [name,args] of [
 ['valid binding',[a,a,a,b]], ['wrong parent',[b,a,a,b]], ['wrong rollback',[a,a,b,b]],
 ['same candidate',[a,a,a,a]], ['short ID',[a,a,a,'b']], ['uppercase ID',[a,a,a,b.toUpperCase()]],
 ['newline ID',[a,a,a,b+'\n']], ['numeric ID',[a,a,a,1]], ['boxed ID',[a,a,a,new String(b)]],
 ['missing ID',[a,a,a]], ['null ID',[a,a,a,null]], ['symbol ID',[a,a,a,Symbol()]]
]) test(name,()=>assert.deepEqual(checkLineage(...args),name==='valid binding'?match:denied));
test('lineage does not coerce proxy',()=>{let calls=0;const p=new Proxy({}, {get(){calls++;throw Error('trap')}});assert.deepEqual(checkLineage(a,a,a,p),denied);assert.equal(calls,0)});
test('lineage revoked proxy',()=>{const p=Proxy.revocable({},{});p.revoke();assert.deepEqual(checkLineage(a,a,a,p.proxy),denied)});
test('lineage results frozen',()=>{assert.ok(Object.isFrozen(checkLineage(a,a,a,b)));assert.ok(Object.isFrozen(checkLineage(a,a,a,a)))});
test('self claimed authority denied',()=>assert.deepEqual(inspectEvolution({status:'PASS',execution_authority:true}),denied));
test('getter not accessed',()=>{let calls=0;assert.deepEqual(inspectEvolution({get status(){calls++;throw Error('getter')}}),denied);assert.equal(calls,0)});
test('proxy no traps',()=>{let calls=0;const trap=()=>{calls++;throw Error('trap')};const p=new Proxy({}, {get:trap,getPrototypeOf:trap,ownKeys:trap,getOwnPropertyDescriptor:trap});assert.deepEqual(inspectEvolution(p),denied);assert.equal(calls,0)});
test('revoked proxy denied',()=>{const p=Proxy.revocable({},{});p.revoke();assert.deepEqual(inspectEvolution(p.proxy),denied)});
test('null and undefined denied',()=>{assert.deepEqual(inspectEvolution(null),denied);assert.deepEqual(inspectEvolution(),denied)});
test('denial immutable',()=>assert.ok(Object.isFrozen(inspectEvolution({}))));
