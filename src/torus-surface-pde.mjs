// Surface diffusion on a torus using a conservative finite-volume discretization.
// Coordinates u,v in [0,2π), metric ds²=(R+r cos(v))² du²+r² dv².
// Cell areas and face fluxes preserve total weighted mass under periodic boundaries.
export function torusGrid({nu=48,nv=24,R=2,r=.65}={}){
 if(!Number.isInteger(nu)||!Number.isInteger(nv)||nu<8||nv<8||nu>256||nv>256||![R,r].every(Number.isFinite)||R<=r||r<=0)throw Error('Invalid torus grid');
 const du=2*Math.PI/nu,dv=2*Math.PI/nv,area=new Float64Array(nu*nv);
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++)area[j*nu+i]=r*(R+r*Math.cos((j+.5)*dv))*du*dv;
 return {nu,nv,R,r,du,dv,area};
}
export function torusSurfaceMass(grid,field){if(field.length!==grid.area.length)throw Error('Field size mismatch');let s=0;for(let k=0;k<field.length;k++){if(!Number.isFinite(field[k]))throw Error('Non-finite field');s+=grid.area[k]*field[k]}return s}
export function torusSurfaceStep(grid,field,{diffusivity=.03,dt=.01}={}){
 const {nu,nv,R,r,du,dv,area}=grid;
 if(field.length!==nu*nv||!Number.isFinite(diffusivity)||diffusivity<0||!Number.isFinite(dt)||dt<=0)throw Error('Invalid diffusion parameters');
 // Conservative face fluxes; a safe bound on sum of positive off-diagonal rates.
 const result=new Float64Array(field.length),flux=new Float64Array(field.length),index=(i,j)=>((j+nv)%nv)*nu+(i+nu)%nu;
 let maxRate=0;
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
  const k=index(i,j),h=R+r*Math.cos((j+.5)*dv),hFace=R+r*Math.cos((j+1)*dv);
  const rateU=diffusivity*r/(h*du*du),rateVPlus=diffusivity*hFace/(r*dv*dv),rateVMinus=diffusivity*(R+r*Math.cos(j*dv))/(r*dv*dv);
  maxRate=Math.max(maxRate,(2*rateU+rateVPlus+rateVMinus)*du*dv/area[k]);
 }
 if(dt*maxRate>1)throw Error('Explicit torus diffusion stability bound exceeded');
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
  const k=index(i,j),ku=index(i+1,j),kv=index(i,j+1);
  const h=R+r*Math.cos((j+.5)*dv),hf=R+r*Math.cos((j+1)*dv);
  const fu=diffusivity*r*dv/(h*du)*(field[ku]-field[k]);
  const fv=diffusivity*hf*du/(r*dv)*(field[kv]-field[k]);
  flux[k]+=fu+fv;flux[ku]-=fu;flux[kv]-=fv;
 }
 for(let k=0;k<result.length;k++){if(!Number.isFinite(field[k]))throw Error('Non-finite field');result[k]=field[k]+dt*flux[k]/area[k]}
 return result;
}
export function torusInitialField(grid,{u=0,v=0,width=.5}={}){
 if(!Number.isFinite(width)||width<=0)throw Error('Invalid pulse width');
 const {nu,nv,du,dv}=grid,result=new Float64Array(nu*nv);
 const angular=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const dU=angular((i+.5)*du,u),dV=angular((j+.5)*dv,v);result[j*nu+i]=Math.exp(-(dU*dU+dV*dV)/(2*width*width))}
 return result;
}
