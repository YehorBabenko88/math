import {torusGrid,torusSurfaceStep,torusSurfaceMass} from './torus-surface-pde.mjs';
import {recoverSeriesFromTorus,compareSignal} from './torus-series.mjs';
// Bilinear periodic deposition from embedded observations to a 2D torus field.
// Every input observation is used as a measured initial condition; empty cells
// use zero deviation from the source-series mean, not inferred observations.
export function depositTorusSeries(embedding,{nu=48,nv=24}={}){
 if(embedding?.kind!=='torus-embedding'||!Array.isArray(embedding.points))throw Error('Invalid torus embedding');
 const grid=torusGrid({nu,nv,R:embedding.geometry.majorRadius,r:embedding.geometry.minorRadius});
 const numerator=new Float64Array(nu*nv),weights=new Float64Array(nu*nv),twoPi=2*Math.PI;
 for(const point of embedding.points){
  if(![point.u,point.v,point.value].every(Number.isFinite))throw Error('Non-finite embedding');
  const U=((point.u/twoPi)%1+1)%1*nu-.5,V=((point.v/twoPi)%1+1)%1*nv-.5;
  const i=Math.floor(U),j=Math.floor(V),fu=U-i,fv=V-j;
  for(const [di,dj,w] of [[0,0,(1-fu)*(1-fv)],[1,0,fu*(1-fv)],[0,1,(1-fu)*fv],[1,1,fu*fv]]){
   const k=((j+dj+nv)%nv)*nu+((i+di+nu)%nu);
   numerator[k]+=w*point.value;weights[k]+=w;
  }
 }
 const field=Float64Array.from(numerator,(sum,k)=>weights[k]?sum/weights[k]:0);
 return {grid,field,weights,coverage:weights.filter(w=>w>0).length/weights.length,assumptions:['Normalized observations are deposited using periodic bilinear interpolation','Unobserved cells are initialized at zero normalized deviation','Collisions between observations are averaged']};
}
export function sampleTorusField(embedding,grid,field){
 if(field.length!==grid.nu*grid.nv)throw Error('Invalid field size');
 const {nu,nv}=grid,twoPi=2*Math.PI;
 return embedding.points.map(point=>{
  const U=((point.u/twoPi)%1+1)%1*nu-.5,V=((point.v/twoPi)%1+1)%1*nv-.5,i=Math.floor(U),j=Math.floor(V),fu=U-i,fv=V-j;
  let result=0;
  for(const [di,dj,w] of [[0,0,(1-fu)*(1-fv)],[1,0,fu*(1-fv)],[0,1,(1-fu)*fv],[1,1,fu*fv]])result+=w*field[((j+dj+nv)%nv)*nu+((i+di+nu)%nu)];
  return result;
 });
}
export function runTorusFieldExperiment(embedding,{nu=48,nv=24,steps=50,diffusivity=.03,dt=.01}={}){
 if(!Number.isInteger(steps)||steps<0||steps>5000)throw Error('Invalid steps');
 const deposited=depositTorusSeries(embedding,{nu,nv}),{grid}=deposited,initialMass=torusSurfaceMass(grid,deposited.field);
 let field=deposited.field;
 for(let i=0;i<steps;i++)field=torusSurfaceStep(grid,field,{diffusivity,dt});
 const normalizedResult=sampleTorusField(embedding,grid,field);
 const original=recoverSeriesFromTorus(embedding),transformed=recoverSeriesFromTorus(embedding,{values:normalizedResult});
 return {grid,field,weights:deposited.weights,coverage:deposited.coverage,initialMass,finalMass:torusSurfaceMass(grid,field),original,transformed,metrics:compareSignal(original,transformed),steps,assumptions:deposited.assumptions.concat('Diffusion is an exploratory transformation of data, not a financial prediction')};
}
