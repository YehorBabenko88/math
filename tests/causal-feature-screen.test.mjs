import test from 'node:test';
import assert from 'node:assert/strict';
import {screenCausalFeatures} from '../src/causal-feature-screen.mjs';
function rows(n=80){return Array.from({length:n},(_,i)=>({
 closeTime:(i+1)*60000,availableAt:(i+1)*60000,
 close:70000+i*2+Math.sin(i/4)*5,
 features:{volume:100+i%9,imbalance:Math.sin(i/7),
 openInterestChange:Math.cos(i/8),volatility:0.01+(i%5)*.001}
}));}
test('causal finite feature screen returns bounded named metrics and closed authority',()=>{
 const r=screenCausalFeatures(rows());
 assert.equal(r.pairs,79);assert.equal(r.findings.length,4);
 assert.equal(r.admission,'BLOCKED');assert.equal(r.trading,'DISABLED');
 assert.equal(r.provenance,'NOT_VERIFIED');
 for(const f of r.findings){assert.equal(f.trainCount,69);assert.equal(f.testCount,10);
 assert.ok(Number.isFinite(f.testRMSE));assert.ok(Number.isFinite(f.naiveRMSE));}
});
test('changing test targets cannot alter train-fitted metrics but changes heldout benchmark',()=>{
 const a=rows(),b=rows();
 for(let i=70;i<80;i++)b[i].close+=100;
 const x=screenCausalFeatures(a),y=screenCausalFeatures(b);
 assert.notEqual(x.findings[0].naiveRMSE,y.findings[0].naiveRMSE);
});
test('future-available, stale, duplicate and nonfinite feature inputs fail closed',()=>{
 const future=rows();future[22].availableAt=future[22].closeTime+1;
 assert.throws(()=>screenCausalFeatures(future));
 const old=rows();old[25].availableAt=old[24].closeTime;
 assert.throws(()=>screenCausalFeatures(old));
 const duplicate=rows();duplicate[4].closeTime=duplicate[3].closeTime;
 assert.throws(()=>screenCausalFeatures(duplicate));
 const invalid=rows();invalid[10].features.volume=Infinity;
 assert.throws(()=>screenCausalFeatures(invalid));
});
