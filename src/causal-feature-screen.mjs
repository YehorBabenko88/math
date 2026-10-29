// Pure offline causal screening of pre-exported features against next-close returns.
// This module does not grant provenance or exchange completeness.
export function screenCausalFeatures(rows,{minTrain=30,minTest=10}={}){
 if(!Array.isArray(rows)||rows.length<minTrain+minTest||rows.length>20000||
    !Number.isSafeInteger(minTrain)||minTrain<10||!Number.isSafeInteger(minTest)||minTest<5)
  throw Error('INVALID_SERIES_SIZE');
 const keys=['volume','imbalance','openInterestChange','volatility'];
 const validated=rows.map((r,i)=>{
  if(!r||!Number.isSafeInteger(r.closeTime)||!Number.isSafeInteger(r.availableAt)||
     !Number.isFinite(r.close)||r.close<=0||!r.features||typeof r.features!=='object'||
     keys.some(k=>typeof r.features[k]!=='number'||!Number.isFinite(r.features[k]))||
     r.availableAt>r.closeTime||r.closeTime<0||
     (i>0&&(r.closeTime<=rows[i-1].closeTime||r.availableAt<=rows[i-1].closeTime)))
    throw Error('UNTRUSTED_OR_NONCAUSAL_FEATURE');
  return r;
 });
 // An observation at t is used only to predict close[t+1]. It must have been
 // available by close[t]; strict time ordering is checked independently.
 const samples=[];
 for(let i=0;i<validated.length-1;i++){
  const here=validated[i],next=validated[i+1];
  samples.push({x:here.features,y:Math.log(next.close/here.close)});
 }
 if(samples.length<minTrain+minTest)throw Error('INSUFFICIENT_PAIRS');
 const cut=samples.length-minTest;
 const train=samples.slice(0,cut),test=samples.slice(cut);
 const baseline=Math.sqrt(test.reduce((s,r)=>s+r.y*r.y,0)/test.length);
 const findings=keys.map(key=>{
  const xs=train.map(s=>s.x[key]),ys=train.map(s=>s.y);
  const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
  const denom=xs.reduce((s,x)=>s+(x-mx)**2,0);
  const slope=denom>1e-20?xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/denom:0;
  // zero-return baseline is included as an explicit train-only candidate.
  const trainModelSSE=train.reduce((s,r)=>s+(r.y-slope*(r.x[key]-mx)-my)**2,0);
  const trainZeroSSE=train.reduce((s,r)=>s+r.y*r.y,0);
  const useModel=trainModelSSE<trainZeroSSE;
  const sse=test.reduce((s,r)=>{
   const p=useModel?slope*(r.x[key]-mx)+my:0;
   return s+(r.y-p)**2;
  },0);
  const rmse=Math.sqrt(sse/test.length);
  if(![slope,mx,my,rmse].every(Number.isFinite))throw Error('NONFINITE_RESULT');
  return {feature:key,selected:useModel?'LINEAR':'ZERO_RETURN',trainCount:train.length,
   testCount:test.length,testRMSE:rmse,naiveRMSE:baseline,
   improvementPercent:baseline>0?100*(1-rmse/baseline):null};
 });
 return {schema:'math.causal-features.v1',pairs:samples.length,findings,
  provenance:'NOT_VERIFIED',admission:'BLOCKED',trading:'DISABLED'};
}
