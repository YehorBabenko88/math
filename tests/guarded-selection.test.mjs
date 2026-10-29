import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGuardedSelection} from '../src/guarded-selection.mjs';
const make=n=>Array.from({length:n},(_,i)=>70000+100*Math.sin(i*.12)+40*Math.cos(i*.29)+i*.15);
test('guarded validation selection is deterministic, bounded and closed',()=>{
 const r=evaluateGuardedSelection(make(700));
 assert.equal(r.windowCount,3);
 assert.deepEqual(r.windows.map(w=>w.start),[0,100,200]);
 assert.equal(r.admission,'BLOCKED');assert.equal(r.trading,'DISABLED');
 for(const w of r.windows){
  assert.deepEqual([w.trainCount,w.validationCount,w.testCount],[300,100,100]);
  assert.equal(w.selected,w.validation.guardedRMSE<w.validation.naiveRMSE?'GUARDED_LANDAU':'NAIVE');
  assert.ok(Number.isFinite(w.test.selectedRMSE));
  assert.ok(w.interventions.changedSelectedPredictions<=100);
  assert.ok(w.interventions.changedGuardedPredictions<=100);
  if(w.selected==='NAIVE'){
   assert.equal(w.test.selectedRMSE,w.test.naiveRMSE);
   assert.equal(w.interventions.changedSelectedPredictions,0);
  }else assert.equal(w.test.selectedRMSE,w.test.guardedRMSE);
 }
});
test('changing held-out test targets leaves model fitting and guarded validation unchanged',()=>{
 const a=make(500),b=a.slice();
 for(let i=400;i<500;i++)b[i]+=5000;
 const x=evaluateGuardedSelection(a).windows[0],y=evaluateGuardedSelection(b).windows[0];
 assert.deepEqual(x.parameters,y.parameters);
 assert.deepEqual(x.validation,y.validation);
 assert.equal(x.selected,y.selected);
 assert.notEqual(x.test.naiveRMSE,y.test.naiveRMSE);
});
test('invalid guard and series are rejected',()=>{
 assert.throws(()=>evaluateGuardedSelection(make(500),{guard:null}));
 assert.throws(()=>evaluateGuardedSelection(make(500),{guard:{maxAbsZ:2,maxDeviation:-1}}));
 assert.throws(()=>evaluateGuardedSelection([...make(499),Infinity]));
 assert.throws(()=>evaluateGuardedSelection(make(500),{stride:0}));
});
