import {evaluateWalkForward} from '../../src/walk-forward.mjs';
// Synthetic deterministic data only; not the ADMINIT price series.
const base=Array.from({length:200},(_,i)=>100+Math.sin(i*.2));
const shifted=base.map((v,i)=>v+(i>=160?40:0));
const guard={maxAbsZ:2,maxDeviation:3};
const results=[];
for(const [scenario,series] of [['ordinary',base],['regime-shift',shifted]])for(const windowSize of [100,200]){
 const raw=evaluateWalkForward(series,{windowSize,stride:windowSize});
 const guarded=evaluateWalkForward(series,{windowSize,stride:windowSize,guard});
 results.push({scenario,windowSize,guard,windows:raw.windows.map((w,i)=>({start:w.start,selected:w.selected,raw:w.test,guarded:guarded.windows[i].test,fallbackCount:guarded.windows[i].diagnostics.fallbackCount,maxAbsZ:Math.max(...guarded.windows[i].diagnostics.steps.map(s=>Math.abs(s.z))),maxDeviation:Math.max(...guarded.windows[i].diagnostics.steps.map(s=>s.absoluteDeviation))}))});
}
console.log(JSON.stringify({kind:'SYNTHETIC_COMPARISON',physical:'NOT_RUN',trading:'DISABLED',results},null,2));
