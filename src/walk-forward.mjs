import {fitLandauMap} from './model-fitting.mjs';

// Pure one-step, chronological walk-forward evaluation. No IO, orders or live access.
export function evaluateWalkForward(series, {
 windowSize=500, stride=100,
 muGrid=[-0.4,-0.2,-0.1,0,0.1,0.2,0.4,0.6],
 betaGrid=[0,0.01,0.02,0.05,0.1,0.2]
}={}) {
 if(!Array.isArray(series)||series.length>20000||series.length<windowSize||series.some(x=>typeof x!=='number'||!Number.isFinite(x)))
  throw Error('Expected bounded finite series covering the window');
 if(!Number.isSafeInteger(windowSize)||windowSize<100||windowSize%5!==0||!Number.isSafeInteger(stride)||stride<1||stride>windowSize)
  throw Error('Invalid walk-forward window or stride');
 const train=windowSize*3/5, validation=windowSize/5, test=windowSize/5;
 const windows=[];
 for(let start=0;start+windowSize<=series.length;start+=stride){
  const block=series.slice(start,start+windowSize);
  // The final test block cannot influence the fitting or selection.
  const development=fitLandauMap(block.slice(0,train+validation),{
   trainFraction:0.75,muGrid,betaGrid
  });
  if(development.trainCount!==train||development.testCount!==validation)throw Error('Unexpected chronological split');
  const chooseModel=development.metrics.modelRMSE<development.metrics.naiveRMSE;
  const {mu,beta}=development.parameters,{mean,sd}=development.normalization;
  if(![mu,beta,mean,sd].every(Number.isFinite)||sd<=0)throw Error('Invalid model state');
  let modelSSE=0,naiveSSE=0,selectedSSE=0;
  for(let i=train+validation;i<windowSize;i++){
   const prev=block[i-1],actual=block[i],z=(prev-mean)/sd;
   const model=(z+mu*z-beta*z*z*z)*sd+mean;
   if(!Number.isFinite(model))throw Error('Nonfinite prediction');
   modelSSE+=(actual-model)**2;
   naiveSSE+=(actual-prev)**2;
   selectedSSE+=(actual-(chooseModel?model:prev))**2;
  }
  const rmse=s=>Math.sqrt(s/test);
  const metrics={modelRMSE:rmse(modelSSE),naiveRMSE:rmse(naiveSSE),selectedRMSE:rmse(selectedSSE)};
  if(!Object.values(metrics).every(Number.isFinite))throw Error('Nonfinite metric');
  windows.push({start,trainEnd:start+train,validationEnd:start+train+validation,testEnd:start+windowSize,
   trainCount:train,validationCount:validation,testCount:test,parameters:{mu,beta},
   validation:{modelRMSE:development.metrics.modelRMSE,naiveRMSE:development.metrics.naiveRMSE},
   selected:chooseModel?'LANDAU':'NAIVE',test:metrics});
 }
 return {schema:'math.walk-forward.v1',windows,windowCount:windows.length,admission:'BLOCKED',trading:'DISABLED'};
}
