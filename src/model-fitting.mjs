import {normalizeSeries} from './cross-domain.mjs';
// A causal one-step benchmark: fit on an initial chronological segment, evaluate
// on untouched later observations. Uses a cubic autoregression as a discrete
// Landau-inspired model; it is NOT the continuous forced Landau ODE.
export function fitLandauMap(series,{trainFraction=.7,muGrid=[-.2,0,.2,.4,.6,.8,1],betaGrid=[0,.02,.05,.1,.2]}={}){
 if(!Array.isArray(series)||series.length<30||series.length>20000||series.some(v=>!Number.isFinite(v)))throw Error('Ожидается не менее 30 числовых наблюдений');
 if(!(trainFraction>=.5&&trainFraction<=.85))throw Error('Доля обучения должна быть от 0.5 до 0.85');
 const cut=Math.floor(series.length*trainFraction),train=series.slice(0,cut);
 const norm=normalizeSeries(train),x=series.map(v=>(v-norm.mean)/norm.sd);
 let best=null;
 for(const mu of muGrid)for(const beta of betaGrid){
  if(!Number.isFinite(mu)||!Number.isFinite(beta)||beta<0)throw Error('Недопустимая сетка параметров');
  let error=0;
  for(let i=1;i<cut;i++){const p=x[i-1]+mu*x[i-1]-beta*x[i-1]**3;error+=(x[i]-p)**2}
  if(!best||error<best.trainSSE)best={mu,beta,trainSSE:error};
 }
 const prediction=[],baseline=[],actual=[];
 for(let i=cut;i<x.length;i++){
  const prev=x[i-1];prediction.push((prev+best.mu*prev-best.beta*prev**3)*norm.sd+norm.mean);
  baseline.push(series[i-1]);actual.push(series[i]);
 }
 const rmse=(a,b)=>Math.sqrt(a.reduce((sum,v,i)=>sum+(v-b[i])**2,0)/a.length);
 return {model:'landau-discrete-cubic',equation:'x[t+1] = (1+μ)x[t] − βx[t]³',parameters:{mu:best.mu,beta:best.beta},trainCount:cut,testCount:actual.length,actual,prediction,baseline,metrics:{modelRMSE:rmse(actual,prediction),naiveRMSE:rmse(actual,baseline)},normalization:{mean:norm.mean,sd:norm.sd},warning:'Дискретная кубическая авторегрессия, вдохновлённая амплитудной нормальной формой Ландау. Не физическое доказательство и не инвестиционный прогноз.'};
}
export function serializeExperiment(result){const {model,equation,parameters,trainCount,testCount,metrics,normalization,warning}=result;return JSON.stringify({schemaVersion:1,model,equation,parameters,trainCount,testCount,metrics,normalization,warning},null,2)}
