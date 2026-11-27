import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLiteraturePrerequisites as assess} from '../src/knowledge/literature-method-evidence.mjs';

const make = () => ({schema:'math.literature.prerequisites.v1',sourceRef:'a'.repeat(64),
  methodRef:'b'.repeat(64),rights:{TEXT:'ALLOWED',DATA:'UNKNOWN',CODE:'DENIED'},
  reviewRef:null,outcome:'SUPPORTED'});
test('claimed permission and support do not grant authority', () => {
  const v=make(); v.reviewRef='c'.repeat(64); v.rights={TEXT:'ALLOWED',DATA:'ALLOWED',CODE:'ALLOWED'};
  const r=assess(v);
  assert.deepEqual(Object.keys(r),['status','reasons','formalProof','execution_authority']);
  assert.equal(r.status,'UNVERIFIED'); assert.equal(r.formalProof,false);
  assert.equal(r.execution_authority,false); assert.ok(r.reasons.includes('EXPORT_NOT_AUTHORIZED'));
  assert.ok(r.reasons.includes('REVIEW_UNVERIFIED'));
});
test('separate rights and missing review', () => {
  const r=assess(make());
  assert.ok(r.reasons.includes('RIGHTS_DATA_UNKNOWN'));
  assert.ok(r.reasons.includes('RIGHTS_CODE_DENIED'));
  assert.ok(r.reasons.includes('REVIEW_MISSING'));
});
test('all negative outcomes retained as distinct reasons', () => {
  for(const outcome of ['CONTRADICTED','INCONCLUSIVE','NOT_APPLICABLE','INSUFFICIENT_DATA','RETRACTED']) {
    const r=assess({...make(),outcome}); assert.ok(r.reasons.includes('OUTCOME_'+outcome));
    assert.equal(r.formalProof,false); assert.equal(r.execution_authority,false);
  }
  assert.ok(assess({...make(),outcome:'RETRACTED'}).reasons.includes('ELIGIBILITY_BLOCKED'));
});
test('null prototype decoded DTO accepted', () => {
  const v=Object.assign(Object.create(null),make());
  v.rights=Object.assign(Object.create(null),v.rights);
  assert.equal(assess(v).status,'UNVERIFIED');
});
test('invalid enum, reference and extra authority rejected', () => {
  for(const v of [{...make(),outcome:'PROVEN'},{...make(),sourceRef:'x'},
    {...make(),formalProof:true},{...make(),rights:{TEXT:'ALLOWED',DATA:'UNKNOWN',CODE:'yes'}},
    {...make(),reviewRef:undefined}]) assert.throws(()=>assess(v),/INVALID_SCHEMA/);
});
test('getters and proxy traps never invoked', () => {
  let calls=0; const v=make();
  Object.defineProperty(v,'sourceRef',{enumerable:true,get(){calls++;return 'a'.repeat(64)}});
  assert.throws(()=>assess(v),/INVALID_SCHEMA/);
  assert.throws(()=>assess(new Proxy(make(),{ownKeys(){calls++;return []}})),/INVALID_SCHEMA/);
  const w=make(); w.rights=new Proxy(w.rights,{get(){calls++;return 'ALLOWED'}});
  assert.throws(()=>assess(w),/INVALID_SCHEMA/); assert.equal(calls,0);
});
test('immutable result and input unchanged', () => {
  const v=make(),before=JSON.stringify(v),r=assess(v);
  assert.equal(JSON.stringify(v),before); assert.ok(Object.isFrozen(r)); assert.ok(Object.isFrozen(r.reasons));
});
