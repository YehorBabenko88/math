import {embedSeriesOnTorus,recoverSeriesFromTorus,diffuseTorusSignal} from './torus-series.mjs';
import {runTorusFieldExperiment} from './torus-field-adapter.mjs';
// A causal, expanding-window benchmark. No observation after index t is read
// when predicting index t. Physics transforms are features, not proven models.
export function benchmarkTransformations(series,{warmup=60,step=5,torusSteps=10}={}){
 if(!Array.isArray(series)||series.length<80||series.length>5000||series.some(v=>!Number.isFinite(v)))throw Error('Expected 80–5000 finite observations');
 if(!Number.isInteger(warmup)||warmup<30||warmup>=series.length||!Number.isInteger(step)||step<1||step>100||!Number.isInteger(torusSteps)||torusSteps<0||torusSteps>1000)throw Error('Invalid benchmark settings');
 const errors={persistence:[],mean:[],torusCycle:[],torusSurface:[]},samples=[];
 for(let t=warmup;t<series.length;t+=step){
  const history=series.slice(0,t),truth=series[t],recent=history.slice(-Math.min(240,history.length)),last=history.at(-1),mean=recent.reduce((a,b)=>a+b,0)/recent.length;
  // Constant windows carry no shape information; all transform candidates reduce to persistence.\n  if(Math.max(...recent)-Math.min(...recent)<1e-12){for(const key of Object.keys(errors))errors[key].push((last-truth)**2);samples.push({index:t,actual:truth,forecasts:{persistence:last,mean:last,torusCycle:last,torusSurface:last}});continue}\n  const embedding=embedSeriesOnTorus(recent);
  const cyclic=diffuseTorusSignal(embedding.points.map(p=>p.value),{steps:torusSteps});
  const cyclicSeries=recoverSeriesFromTorus(embedding,{values:cyclic});
  const surface=runTorusFieldExperiment(embedding,{steps:torusSteps,nu:24,nv:16});
  const forecasts={persistence:last,mean,torusCycle:cyclicSeries.at(-1),torusSurface:surface.transformed.at(-1)};
  for(const [key,value] of Object.entries(forecasts)){if(!Number.isFinite(value))throw Error('Non-finite benchmark prediction');errors[key].push((value-truth)**2)}
  samples.push({index:t,actual:truth,forecasts});
 }
 const rmse=Object.fromEntries(Object.entries(errors).map(([key,values])=>[key,Math.sqrt(values.reduce((a,b)=>a+b,0)/values.length)]));
 const baseline=rmse.persistence;
 return {samples:samples.length,rmse,relativeToPersistence:Object.fromEntries(Object.entries(rmse).map(([k,v])=>[k,baseline>0?(baseline-v)/baseline:null])),protocol:{type:'expanding-window-one-step',warmup,step,forecastHorizon:1,historyLimit:240},limitations:['This is a causal out-of-sample comparison, not evidence of stable predictive edge','Hyperparameters are fixed; tuning requires nested validation','Sampling every step points produces overlapping histories and correlated errors']};
}
