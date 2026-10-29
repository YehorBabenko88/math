import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateWalkForward} from '../src/walk-forward.mjs';
const series=n=>Array.from({length:n},(_,i)=>70000+140*Math.sin(i*.11)+30*Math.sin(i*.31)+i*.3);
test('chronological 60/20/20 and finite results',()=>{
 const r=evaluateWalkForward(series(700));
 assert.equal(r.windowCount,3);
 assert.deepEqual(r.windows.map(x=>x.start),[0,100,200]);
 for(const w of r.windows){
  assert.equal(w.trainCount,300);assert.equal(w.validationCount,100);assert.equal(w.testCount,100);
  assert.equal(w.trainEnd-w.start,300);assert.equal(w.validationEnd-w.trainEnd,100);assert.equal(w.testEnd-w.validationEnd,100);
  assert.ok(['NAIVE','LANDAU'].includes(w.selected));
  assert.ok(Object.values(w.test).every(Number.isFinite));
  if(w.selected==='NAIVE')assert.equal(w.test.selectedRMSE,w.test.naiveRMSE);
  else assert.equal(w.test.selectedRMSE,w.test.modelRMSE);
 }
 assert.equal(r.admission,'BLOCKED');assert.equal(r.trading,'DISABLED');
});
test('held-out test modifications cannot affect fitted parameters or selection for same window',()=>{
 const x=series(500),y=[...x];
 for(let i=400;i<500;i++)y[i]+=3000;
 const a=evaluateWalkForward(x).windows[0],b=evaluateWalkForward(y).windows[0];
 assert.deepEqual(a.parameters,b.parameters);
 assert.deepEqual(a.validation,b.validation);
 assert.equal(a.selected,b.selected);
 assert.notEqual(a.test.naiveRMSE,b.test.naiveRMSE);
});
test('invalid input and unsafe boundaries fail',()=>{
 for(const x of [[],Array(500).fill(1),[...series(499)], [...series(500).slice(0,499),NaN]])
  assert.throws(()=>evaluateWalkForward(x));
 for(const options of [{windowSize:99},{windowSize:501},{stride:0},{stride:501}])
  assert.throws(()=>evaluateWalkForward(series(600),options));
});
