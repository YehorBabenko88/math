// Read-only return-domain research. Forecasts use only prior observed closes.
// Candidate coefficients chosen by train; family-vs-naive chosen by validation.
// No live connectors, trading, persistence or external dependencies.
export function evaluateReturnResearch(prices,{
 windowSize=500,stride=500,lookback=20,alphas=[0,0.1,0.25,0.5],
 maxVolMultiple=2
}={}){
 if(!Array.isArray(prices)||prices.length>20000||prices.some(p=>typeof p!=='number'||!Number.isFinite(p)||p<=0))
  throw Error('Expected finite positive prices');
 if(!Number.isSafeInteger(windowSize)||windowSize<100||windowSize%5!==0||prices.length<windowSize||
    !Number.isSafeInteger(stride)||stride<1||stride>windowSize||
    !Number.isSafeInteger(lookback)||lookback<2||lookback>=windowSize/5||
    !Array.isArray(alphas)||alphas.length<1||alphas.length>20||
    alphas.some(a=>typeof a!=='number'||!Number.isFinite(a)||a<0||a>1)||
    !Number.isFinite(maxVolMultiple)||maxVolMultiple<=0)throw Error('Invalid research options');
 const windows=[];
 for(let start=0;start+windowSize<=prices.length;start+=stride){
  const data=prices.slice(start,start+windowSize);
  const train=windowSize*3/5,val=windowSize/5,test=windowSize/5;
  const logReturns=data.map((p,i)=>i===0?null:Math.log(p/data[i-1]));
  function prediction(i,alpha){
   // Last available return is i-1; today's target price data[i] is not read.
   const past=logReturns.slice(i-lookback,i);
   if(past.some(x=>!Number.isFinite(x)))throw Error('Insufficient past returns');
   const mean=past.reduce((s,x)=>s+x,0)/lookback;
   const volatility=Math.sqrt(past.reduce((s,x)=>s+(x-mean)**2,0)/lookback);
   const expected=Math.max(-maxVolMultiple*volatility,
      Math.min(maxVolMultiple*volatility,alpha*mean));
   const forecast=data[i-1]*Math.exp(expected);
   if(!Number.isFinite(forecast))throw Error('Nonfinite forecast');
   return forecast;
  }
  function evaluate(from,to,alpha){
   let sse=0,naiveSSE=0,abs=0,naiveAbs=0,improved=0,changed=0;
   for(let i=from;i<to;i++){
    const actual=data[i],guess=prediction(i,alpha),naive=data[i-1];
    const e=Math.abs(actual-guess),n=Math.abs(actual-naive);
    sse+=e*e;naiveSSE+=n*n;abs+=e;naiveAbs+=n;
    if(e<n)improved++;
    if(guess!==naive)changed++;
   }
   const n=to-from;
   const result={modelRMSE:Math.sqrt(sse/n),naiveRMSE:Math.sqrt(naiveSSE/n),
    modelMAE:abs/n,naiveMAE:naiveAbs/n,improvedSteps:improved,changedSteps:changed};
   if(!Object.values(result).every(Number.isFinite))throw Error('Invalid metrics');
   return result;
  }
  let alpha=null,best=Infinity;
  for(const a of alphas){
   const trainMetric=evaluate(lookback+1,train,a).modelRMSE;
   if(trainMetric<best){best=trainMetric;alpha=a;}
  }
  const validation=evaluate(train,train+val,alpha);
  const selected=validation.modelRMSE<validation.naiveRMSE?'RETURN_MODEL':'NAIVE';
  const heldOut=evaluate(train+val,windowSize,alpha);
  const testMetrics=selected==='RETURN_MODEL'?heldOut:{
   ...heldOut,modelRMSE:heldOut.naiveRMSE,modelMAE:heldOut.naiveMAE,
   changedSteps:0,improvedSteps:0};
  windows.push({start,trainCount:train,validationCount:val,testCount:test,
   alpha,selected,validation,test:{raw:heldOut,selected:{
    rmse:testMetrics.modelRMSE,mae:testMetrics.modelMAE,
    naiveRMSE:heldOut.naiveRMSE,naiveMAE:heldOut.naiveMAE,
    changedSteps:testMetrics.changedSteps,improvedSteps:testMetrics.improvedSteps}}});
 }
 return {schema:'math.returns-research.v1',windows,windowCount:windows.length,
  guard:{lookback,maxVolMultiple},admission:'BLOCKED',trading:'DISABLED'};
}
