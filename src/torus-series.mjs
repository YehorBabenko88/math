// Reversible index-preserving embedding of observations on a torus.
// This is a geometric encoding, not a physical interpretation or a forecast.
export function embedSeriesOnTorus(values,{majorRadius=2,minorRadius=.65,turns=3,phase=0}={}){
 if(!Array.isArray(values)||values.length<8||values.length>20000||values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Expected 8–20000 finite observations');
 if(![majorRadius,minorRadius,turns,phase].every(Number.isFinite)||majorRadius<=minorRadius||minorRadius<=0||turns<=0||turns>100)throw Error('Invalid torus geometry');
 const mean=values.reduce((s,v)=>s+v,0)/values.length,sd=Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/values.length);
 if(sd<1e-12)throw Error('Constant series cannot be normalized');
 const normalized=values.map(v=>(v-mean)/sd),n=values.length;
 const points=normalized.map((value,index)=>{
  const u=2*Math.PI*turns*index/n+phase,v=2*Math.atan(value);
  return {index,u,v,x:(majorRadius+minorRadius*Math.cos(v))*Math.cos(u),y:(majorRadius+minorRadius*Math.cos(v))*Math.sin(u),z:minorRadius*Math.sin(v),value};
 });
 return {kind:'torus-embedding',points,source:values.slice(),normalization:{mean,sd},geometry:{majorRadius,minorRadius,turns,phase},assumptions:['Time maps to toroidal longitude; normalized signal maps to minor-circle angle via 2 atan(z)','Mapping is an encoding; geometry is not a physical market model']};
}
export function recoverSeriesFromTorus(embedding,{values}={}){
 if(embedding?.kind!=='torus-embedding'||!Array.isArray(embedding.points))throw Error('Invalid embedding');
 const n=embedding.points.length,signal=values??embedding.points.map(p=>p.value);
 if(signal.length!==n||Array.from(signal).some(v=>!Number.isFinite(v)))throw Error('Invalid return field');
 const result=new Array(n);
 for(let i=0;i<n;i++){const k=embedding.points[i].index;if(!Number.isInteger(k)||k<0||k>=n||result[k]!==undefined)throw Error('Invalid index correspondence');result[k]=signal[i]*embedding.normalization.sd+embedding.normalization.mean}
 return result;
}
// Circular diffusion on the ordered sampling path: a numerical experiment,
// not hydrodynamics on the full 2D toroidal surface.
export function diffuseTorusSignal(values,{alpha=.1,steps=50}={}){
 if(!Array.isArray(values)||values.length<8||values.some(v=>!Number.isFinite(v)))throw Error('Invalid signal');
 if(!Number.isFinite(alpha)||alpha<0||alpha>.5||!Number.isInteger(steps)||steps<0||steps>10000)throw Error('Invalid diffusion settings');
 let state=values.slice();const n=state.length;
 for(let t=0;t<steps;t++){const next=new Array(n);for(let i=0;i<n;i++)next[i]=state[i]+alpha*(state[(i+n-1)%n]+state[(i+1)%n]-2*state[i]);state=next}
 return state;
}
export function compareSignal(original,derived){
 if(original.length!==derived.length||original.length===0||[...original,...derived].some(v=>!Number.isFinite(v)))throw Error('Invalid comparison');
 const n=original.length,mean=v=>v.reduce((a,b)=>a+b,0)/n,m1=mean(original),m2=mean(derived);
 const rmse=Math.sqrt(original.reduce((s,v,i)=>s+(v-derived[i])**2,0)/n);
 const covariance=original.reduce((s,v,i)=>s+(v-m1)*(derived[i]-m2),0);
 const a=original.reduce((s,v)=>s+(v-m1)**2,0),b=derived.reduce((s,v)=>s+(v-m2)**2,0);
 return {rmse,correlation:a>0&&b>0?covariance/Math.sqrt(a*b):null,interpretation:'In-sample descriptive comparison only; no predictive validity established'};
}
