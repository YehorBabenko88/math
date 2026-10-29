import {fitLandauMap} from './model-fitting.mjs';

function validateGuard(guard) {
 if(guard===null)return;
 if(!guard||typeof guard!=='object'||Array.isArray(guard)||Object.keys(guard).sort().join(',')!=='maxAbsZ,maxDeviation'||!Number.isFinite(guard.maxAbsZ)||guard.maxAbsZ<=0||!Number.isFinite(guard.maxDeviation)||guard.maxDeviation<0)throw Error('Invalid explicit guard policy');
}
// Pure causal step: no actual/current or future label is accepted.
export function forecastLandauStep(previous,{mu,beta,mean,sd},{minZ,maxZ},guard=null){
 validateGuard(guard);
 if(![previous,mu,beta,mean,sd,minZ,maxZ].every(Number.isFinite)||sd<=0||beta<0||minZ>maxZ)throw Error('Invalid forecast state');
 const z=(previous-mean)/sd;
 const raw=(z+mu*z-beta*z*z*z)*sd+mean;
 const deviation=Math.abs(raw-previous);
 let reason='MODEL';
 if(!Number.isFinite(z)||!Number.isFinite(raw)||!Number.isFinite(deviation))reason='NONFINITE';
 else if(guard&&(z<minZ||z>maxZ||Math.abs(z)>guard.maxAbsZ))reason='OUTSIDE_TRAINING_DOMAIN';
 else if(guard&&deviation>guard.maxDeviation)reason='EXCESSIVE_DEVIATION';
 if(reason==='NONFINITE'&&!guard)throw Error('Nonfinite prediction');
 return {z:Number.isFinite(z)?z:null,rawPrediction:Number.isFinite(raw)?raw:null,absoluteDeviation:Number.isFinite(deviation)?deviation:null,prediction:guard&&reason!=='MODEL'?previous:raw,reason};
}

// Pure one-step, chronological walk-forward evaluation. No IO, orders or live access.
export function evaluateWalkForward(series, {
 windowSize=500, stride=100,
 muGrid=[-0.4,-0.2,-0.1,0,0.1,0.2,0.4,0.6],
 betaGrid=[0,0.01,0.02,0.05,0.1,0.2], guard=null
}={}) {
 if(!Array.isArray(series)||series.length>20000||series.length<windowSize||series.some(x=>typeof x!=='number'||!Number.isFinite(x)))
  throw Error('Expected bounded finite series covering the window');
 if(!Number.isSafeInteger(windowSize)||windowSize<100||windowSize%5!==0||!Number.isSafeInteger(stride)||stride<1||stride>windowSize)
  throw Error('Invalid walk-forward window or stride');
 validateGuard(guard);
 const train=windowSize*3/5, validation=windowSize/5, test=windowSize/5;
 const windows=[];
 for(let start=0;start+windowSize<=series.length;start+=stride){
  const block=series.slice(start,start+windowSize);
  // The final test block cannot influence the fitting or selection.
  const development=fitLandauMap(block.slice(0,train+validation),{
   trainFraction:0.75,muGrid,betaGrid
  });
  if(development.trainCount!==train||development.testCount!==validation)throw Error('Unexpected chronological split');
  if(guard&&!Object.values(development.metrics).every(Number.isFinite))throw Error('Invalid validation metrics');
  const chooseModel=development.metrics.modelRMSE<development.metrics.naiveRMSE;
  const {mu,beta}=development.parameters,{mean,sd}=development.normalization;
  if(![mu,beta,mean,sd].every(Number.isFinite)||sd<=0)throw Error('Invalid model state');
  const trainZ=block.slice(0,train).map(v=>(v-mean)/sd);
  const domain={minZ:Math.min(...trainZ),maxZ:Math.max(...trainZ)};
  const steps=[];let fallbackCount=0;
  let modelSSE=0,naiveSSE=0,selectedSSE=0,guardedSSE=0;
  for(let i=train+validation;i<windowSize;i++){
   const prev=block[i-1],actual=block[i];
   const step=forecastLandauStep(prev,{mu,beta,mean,sd},domain,guard);
   const model=step.rawPrediction===null?NaN:step.rawPrediction;
   const guarded=step.prediction;
   if(guard&&step.reason!=='MODEL')fallbackCount++;
   steps.push({index:start+i,previous:prev,z:step.z,rawPrediction:step.rawPrediction,absoluteDeviation:step.absoluteDeviation,guardReason:step.reason,guardedPrediction:guarded,selectedPrediction:chooseModel?guarded:prev});
   modelSSE+=(actual-model)**2;
   naiveSSE+=(actual-prev)**2;
   guardedSSE+=(actual-guarded)**2;
   selectedSSE+=(actual-(chooseModel?guarded:prev))**2;
  }
  const rmse=s=>Math.sqrt(s/test);
  const metrics={modelRMSE:rmse(modelSSE),naiveRMSE:rmse(naiveSSE),selectedRMSE:rmse(selectedSSE)};
  if(!Number.isFinite(metrics.naiveRMSE)||!Number.isFinite(metrics.selectedRMSE)||(!guard&&!Number.isFinite(metrics.modelRMSE)))throw Error('Nonfinite metric');
  if(guard){metrics.guardedRMSE=rmse(guardedSSE);if(!Number.isFinite(metrics.guardedRMSE))throw Error('Nonfinite metric');if(!Number.isFinite(metrics.modelRMSE))metrics.modelRMSE=null;}
  windows.push({start,trainEnd:start+train,validationEnd:start+train+validation,testEnd:start+windowSize,
   trainCount:train,validationCount:validation,testCount:test,parameters:{mu,beta},
   validation:{modelRMSE:development.metrics.modelRMSE,naiveRMSE:development.metrics.naiveRMSE},
   diagnostics:{guardEnabled:guard!==null,policy:guard?{...guard}:null,mean,sd,...domain,fallbackCount,steps},
   selected:chooseModel?'LANDAU':'NAIVE',test:metrics});
 }
 return {schema:'math.walk-forward.v1',windows,windowCount:windows.length,admission:'BLOCKED',trading:'DISABLED'};
}
