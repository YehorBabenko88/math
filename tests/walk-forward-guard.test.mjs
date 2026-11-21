import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateWalkForward, forecastLandauStep} from '../src/walk-forward.mjs';
const state={mu:.2,beta:.1,mean:100,sd:2};
const policy={maxAbsZ:2,maxDeviation:3};
test('cubic extrapolation is extreme; opt-in guard uses training bounds',()=>{
 const raw=forecastLandauStep(120,state,{minZ:-2,maxZ:2});
 assert.equal(raw.z,10);assert.equal(raw.rawPrediction,-76);assert.equal(raw.absoluteDeviation,196);
 const g=forecastLandauStep(120,state,{minZ:-2,maxZ:2},policy);
 assert.equal(g.prediction,120);assert.equal(g.reason,'OUTSIDE_TRAINING_DOMAIN');
});
test('ordinary domain passes; excessive deviation and invalid numbers fail closed',()=>{
 assert.equal(forecastLandauStep(101,state,{minZ:-2,maxZ:2},policy).reason,'MODEL');
 assert.equal(forecastLandauStep(102,{...state,mu:10},{minZ:-2,maxZ:2},policy).reason,'EXCESSIVE_DEVIATION');
 for(const p of [{maxAbsZ:NaN,maxDeviation:3},{maxAbsZ:2,maxDeviation:Infinity},{maxAbsZ:0,maxDeviation:3}])assert.throws(()=>forecastLandauStep(101,state,{minZ:-2,maxZ:2},p));
 for(const s of [{...state,sd:0},{...state,beta:NaN}])assert.throws(()=>forecastLandauStep(101,s,{minZ:-2,maxZ:2},policy));
 assert.equal(forecastLandauStep(1e200,state,{minZ:-2,maxZ:2},policy).prediction,1e200);
});
const series=()=>Array.from({length:100},(_,i)=>100+Math.sin(i*.2));
test('regime shift falls back; changing current/future labels cannot change decision',()=>{
 const x=series();for(let i=80;i<100;i++)x[i]+=40;
 const a=evaluateWalkForward(x,{windowSize:100,guard:policy}).windows[0];
 const y=[...x];y[85]+=200;
 const b=evaluateWalkForward(y,{windowSize:100,guard:policy}).windows[0];
 assert.deepEqual(a.diagnostics.steps.slice(0,6),b.diagnostics.steps.slice(0,6));
 assert.ok(a.diagnostics.steps.slice(1).every(s=>s.guardReason==='OUTSIDE_TRAINING_DOMAIN'));
 assert.equal(a.diagnostics.fallbackCount,19);
 assert.deepEqual(a.parameters,b.parameters);
 assert.equal(a.selected,b.selected);
 assert.equal(a.diagnostics.steps[0].index,80);
 assert.equal(a.diagnostics.steps[1].z,(x[80]-a.diagnostics.mean)/a.diagnostics.sd);
});
test('opt-out keeps raw selected metrics; guard does not promise RMSE improvement',()=>{
 const x=series();const a=evaluateWalkForward(x,{windowSize:100}).windows[0];
 assert.equal(a.test.selectedRMSE,a.selected==='LANDAU'?a.test.modelRMSE:a.test.naiveRMSE);
 assert.equal(a.diagnostics.guardEnabled,false);
 assert.throws(()=>evaluateWalkForward(x,{windowSize:100,guard:{maxAbsZ:2,maxDeviation:-1}}));
});

test('guard rejects nonfinite validation metrics rather than selecting naive as success',()=>{const x=series();x[65]=1e200;assert.throws(()=>evaluateWalkForward(x,{windowSize:100,guard:policy}),/Invalid validation/);});
