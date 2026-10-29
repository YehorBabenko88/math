import {fitLandauMap} from './model-fitting.mjs';
import {forecastLandauStep} from './walk-forward.mjs';

// Experimental guarded selection: train 60%, select with guarded validation 20%,
// evaluate held-out test 20%. Never accepts future target in a forecast decision.
export function evaluateGuardedSelection(series,{
 windowSize=500,stride=100,
 guard={maxAbsZ:2,maxDeviation:100},
 muGrid=[-.4,-.2,-.1,0,.1,.2,.4,.6],
 betaGrid=[0,.01,.02,.05,.1,.2]
}={}){
 if(!Array.isArray(series)||series.length>20000||series.length<windowSize||
   series.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Invalid finite input series');
 if(!Number.isSafeInteger(windowSize)||windowSize<100||windowSize%5!==0||
    !Number.isSafeInteger(stride)||stride<1||stride>windowSize)throw Error('Invalid window settings');
 if(!guard||Object.keys(guard).sort().join(',')!=='maxAbsZ,maxDeviation'||
    !Number.isFinite(guard.maxAbsZ)||guard.maxAbsZ<=0||
    !Number.isFinite(guard.maxDeviation)||guard.maxDeviation<0)throw Error('Invalid guard');
 const nTrain=windowSize*3/5,nVal=windowSize/5,nTest=windowSize/5;
 const windows=[];
 for(let start=0;start+windowSize<=series.length;start+=stride){
  const block=series.slice(start,start+windowSize);
  const fitted=fitLandauMap(block.slice(0,nTrain+nVal),{
   trainFraction:.75,muGrid,betaGrid
  });
  if(fitted.trainCount!==nTrain||fitted.testCount!==nVal)throw Error('Unexpected fitting split');
  const {mu,beta}=fitted.parameters,{mean,sd}=fitted.normalization;
  if(![mu,beta,mean,sd].every(Number.isFinite)||sd<=0)throw Error('Invalid fit');
  const zs=block.slice(0,nTrain).map(v=>(v-mean)/sd);
  const domain={minZ:Math.min(...zs),maxZ:Math.max(...zs)};
  const state={mu,beta,mean,sd};
  const evaluate=(from,to)=>{
   let naiveSSE=0,rawSSE=0,guardedSSE=0,potential=0,changedGuarded=0;
   const steps=[];
   for(let i=from;i<to;i++){
    const prev=block[i-1],actual=block[i];
    const step=forecastLandauStep(prev,state,domain,guard);
    // The source guarded API deliberately returns null for nonfinite raw.
    const raw=step.rawPrediction;
    if(step.reason!=='MODEL')potential++;
    if(step.prediction!==raw)changedGuarded++;
    naiveSSE+=(actual-prev)**2;
    guardedSSE+=(actual-step.prediction)**2;
    rawSSE=raw===null?Infinity:rawSSE+(actual-raw)**2;
    steps.push({index:start+i,previous:prev,actual,
     guardedPrediction:step.prediction,rawPrediction:raw,reason:step.reason});
   }
   const size=to-from,rmse=s=>Math.sqrt(s/size);
   const naiveRMSE=rmse(naiveSSE),guardedRMSE=rmse(guardedSSE),rawRMSE=rmse(rawSSE);
   if(![naiveRMSE,guardedRMSE].every(Number.isFinite))throw Error('Nonfinite evaluation');
   return {naiveRMSE,guardedRMSE,rawRMSE:Number.isFinite(rawRMSE)?rawRMSE:null,
    potential,changedGuarded,steps};
  };
  const validation=evaluate(nTrain,nTrain+nVal);
  const selected=validation.guardedRMSE<validation.naiveRMSE?'GUARDED_LANDAU':'NAIVE';
  const test=evaluate(nTrain+nVal,windowSize);
  let selectedSSE=0,changedSelected=0;
  for(const step of test.steps){
   const prediction=selected==='GUARDED_LANDAU'?step.guardedPrediction:step.previous;
   if(prediction!==step.previous)changedSelected++;
   selectedSSE+=(step.actual-prediction)**2;
  }
  const selectedRMSE=Math.sqrt(selectedSSE/nTest);
  if(!Number.isFinite(selectedRMSE))throw Error('Nonfinite selected metric');
  // Strip actual target prices and individual forecasts from externally returned record.
  const {steps:valSteps,...valMetrics}=validation;
  const {steps:testSteps,...testMetrics}=test;
  windows.push({start,trainCount:nTrain,validationCount:nVal,testCount:nTest,
   parameters:{mu,beta},selected,validation:valMetrics,
   test:{...testMetrics,selectedRMSE},
   interventions:{potentialFallbacks:test.potential,
    changedGuardedPredictions:test.changedGuarded,changedSelectedPredictions:changedSelected}});
 }
 return {schema:'math.guarded-selection.v1',guard:{...guard},windows,windowCount:windows.length,
  admission:'BLOCKED',trading:'DISABLED'};
}
