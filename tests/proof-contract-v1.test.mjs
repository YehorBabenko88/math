// Local developer tests, NOT independent acceptance fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compareProofBinding} from '../src/proof/goal-binding.mjs';
const fields = ['theorem_revision','theorem_content_hash','typed_goal_hash','ordered_context_hash','source_manifest_hash','translation_evidence_hash','profile_hash','admission_policy_hash','verifier_build_hash','verification_policy_hash','request_id'];
const binding = () => Object.fromEntries(fields.map(k=>[k,'a'.repeat(64)]));
test('equal bindings never establish proof',()=>assert.deepEqual(compareProofBinding(binding(),binding()),{status:'BINDING_MATCH_ONLY',formalProof:false}));
for(const field of fields) test('reject substitution '+field,()=>assert.equal(compareProofBinding(binding(),{...binding(),[field]:'b'.repeat(64)}).reason,'BINDING_MISMATCH'));
test('reject legacy empirical status',()=>assert.equal(compareProofBinding(binding(),{status:'reproduced'}).status,'REFUSED'));
test('reject extra field',()=>assert.equal(compareProofBinding(binding(),{...binding(),status:'PASS'}).status,'REFUSED'));
test('reject accessor without reading',()=>{const x=binding();Object.defineProperty(x,'typed_goal_hash',{get(){throw Error('accessed')}});assert.equal(compareProofBinding(binding(),x).status,'REFUSED')});

test('reject uppercase digest',()=>assert.equal(compareProofBinding(binding(),{...binding(),request_id:'A'.repeat(64)}).status,'REFUSED'));
test('reject missing field',()=>{const x=binding();delete x.verification_policy_hash;assert.equal(compareProofBinding(binding(),x).status,'REFUSED')});
test('reject symbol property',()=>assert.equal(compareProofBinding(binding(),{...binding(),[Symbol('extra')]:true}).status,'REFUSED'));
test('reject legacy prefixed digest',()=>assert.equal(compareProofBinding(binding(),{...binding(),typed_goal_hash:'sha256:'+'a'.repeat(64)}).status,'REFUSED'));

test('accept inert null prototype',()=>assert.equal(compareProofBinding(binding(),Object.assign(Object.create(null),binding())).status,'BINDING_MATCH_ONLY'));
test('reject Proxy without invoking traps',()=>{const x=new Proxy(binding(),{getPrototypeOf(){throw Error('trap')},ownKeys(){throw Error('trap')}});assert.equal(compareProofBinding(binding(),x).status,'REFUSED')});
test('reject hidden field',()=>{const x=binding();Object.defineProperty(x,'request_id',{enumerable:false});assert.equal(compareProofBinding(binding(),x).status,'REFUSED')});
test('reject revoked proxy without reflection',()=>{const {proxy,revoke}=Proxy.revocable(binding(),{});revoke();assert.equal(compareProofBinding(binding(),proxy).status,'REFUSED')});
test('reject oversized field roster',()=>{const x=binding();for(let i=0;i<1024;i++)Object.defineProperty(x,'extra'+i,{get(){throw Error('accessed')}});assert.equal(compareProofBinding(binding(),x).status,'REFUSED')});
test('reject replacement field with same roster size',()=>{const x=binding();delete x.request_id;x.extra='a'.repeat(64);assert.equal(compareProofBinding(binding(),x).status,'REFUSED')});
test('R deny-only: refusal cannot assert formal proof',()=>{for(const result of [compareProofBinding(null,binding()),compareProofBinding(binding(),{...binding(),request_id:'b'.repeat(64)})]){assert.equal(result.status,'REFUSED');assert.notEqual(result.formalProof,true);assert.ok(Object.isFrozen(result))}});
test('R deny-only: identical self-asserted bindings remain nonproof',()=>{const x=binding();const result=compareProofBinding(x,x);assert.equal(result.formalProof,false);assert.ok(Object.isFrozen(result))});
test('reject inherited binding roster',()=>assert.equal(compareProofBinding(binding(),Object.create(binding())).status,'REFUSED'));
test('all mismatches report exact field without disclosing values',()=>{for(const field of fields){const r=compareProofBinding(binding(),{...binding(),[field]:'b'.repeat(64)});assert.deepEqual(r,{status:'REFUSED',reason:'BINDING_MISMATCH',field});assert.ok(Object.isFrozen(r))}});
test('invalid expected binding cannot be rescued by valid observed binding',()=>{const x=binding();delete x.request_id;assert.deepEqual(compareProofBinding(x,binding()),{status:'REFUSED',reason:'INVALID_BINDING'})});
test('frozen null-prototype DTOs remain unchanged',()=>{const x=Object.freeze(Object.assign(Object.create(null),binding()));const y=Object.freeze(Object.assign(Object.create(null),binding()));assert.deepEqual(compareProofBinding(x,y),{status:'BINDING_MATCH_ONLY',formalProof:false});assert.deepEqual(x,y)});
