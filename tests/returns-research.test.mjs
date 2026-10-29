import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReturnResearch} from '../src/returns-research.mjs';
const series=n=>Array.from({length:n},(_,i)=>70000+50*Math.sin(i*.13)+i*.4);
test('separate chronological windows and finite metrics',()=>{
 const r=evaluateReturnResearch(series(1000));
 assert.equal(r.windowCount,2);
 assert.deepEqual(r.windows.map(w=>w.start),[0,500]);
 for(const w of r.windows){
  assert.deepEqual([w.trainCount,w.validationCount,w.testCount],[300,100,100]);
  assert.equal(w.selected,w.validation.modelRMSE<w.validation.naiveRMSE?'RETURN_MODEL':'NAIVE');
  assert.ok(Number.isFinite(w.test.selected.rmse));
  if(w.selected==='NAIVE')assert.equal(w.test.selected.rmse,w.test.selected.naiveRMSE);
 }
 assert.equal(r.trading,'DISABLED');
 assert.equal(r.admission,'BLOCKED');
});
test('held-out edits cannot alter parameter selection or validation',()=>{
 const a=series(500),b=a.slice();for(let i=400;i<500;i++)b[i]+=1000;
 const x=evaluateReturnResearch(a).windows[0],y=evaluateReturnResearch(b).windows[0];
 assert.equal(x.alpha,y.alpha);
 assert.equal(x.selected,y.selected);
 assert.deepEqual(x.validation,y.validation);
 assert.notEqual(x.test.selected.naiveRMSE,y.test.selected.naiveRMSE);
});
test('invalid inputs fail without authority',()=>{
 assert.throws(()=>evaluateReturnResearch([...series(499),0]));
 assert.throws(()=>evaluateReturnResearch(series(499)));
 assert.throws(()=>evaluateReturnResearch(series(500),{lookback:0}));
 assert.throws(()=>evaluateReturnResearch(series(500),{alphas:[NaN]}));
});
