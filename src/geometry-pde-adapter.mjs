// Geometry-to-PDE adapter. Negative signed field means inside the fluid domain.
// max/min preserve set membership, but not necessarily exact signed distance.
export const circle=(cx,cy,r)=>{if(![cx,cy,r].every(Number.isFinite)||r<=0)throw Error('Invalid circle');return (x,y)=>Math.hypot(x-cx,y-cy)-r};
export const rectangle=(cx,cy,hx,hy)=>{if(![cx,cy,hx,hy].every(Number.isFinite)||hx<=0||hy<=0)throw Error('Invalid rectangle');return(x,y)=>Math.max(Math.abs(x-cx)-hx,Math.abs(y-cy)-hy)};
export function combineDomains(a,b,operation='intersection'){
 if(typeof a!=='function'||typeof b!=='function')throw Error('Domains must be functions');
 if(operation==='intersection')return(x,y)=>Math.max(a(x,y),b(x,y));
 if(operation==='union')return(x,y)=>Math.min(a(x,y),b(x,y));
 if(operation==='difference')return(x,y)=>Math.max(a(x,y),-b(x,y));
 throw Error('Unknown set operation');
}
export function rasterizeDomain(field,{size=60,extent=1.5}={}){
 if(!Number.isInteger(size)||size<8||size>160||!Number.isFinite(extent)||extent<=0)throw Error('Invalid raster settings');
 const dx=2*extent/(size-1),mask=new Uint8Array(size*size);let cells=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const v=field(-extent+x*dx,-extent+y*dx);if(!Number.isFinite(v))throw Error('Non-finite geometry');if(v<=0){mask[y*size+x]=1;cells++}}
 return {size,extent,dx,mask,cells};
}
// Conservative explicit finite-volume-like diffusion of a passive scalar.
// No flux crosses mask boundaries. This is NOT a Navier–Stokes solver.
export function diffusionStep(domain,concentration,{diffusivity=.08,dt=.01}={}){
 const {size,dx,mask}=domain;if(!(mask instanceof Uint8Array)||mask.length!==size*size||concentration.length!==mask.length)throw Error('Invalid field dimensions');
 if(!Number.isFinite(diffusivity)||diffusivity<0||!Number.isFinite(dt)||dt<=0||diffusivity*dt/(dx*dx)>.25)throw Error('Explicit diffusion stability bound exceeded');
 const next=new Float64Array(concentration.length),alpha=diffusivity*dt/(dx*dx);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const k=y*size+x;if(!mask[k])continue;const c=concentration[k];if(!Number.isFinite(c))throw Error('Non-finite concentration');
  let flux=0;for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(xx>=0&&xx<size&&yy>=0&&yy<size){const q=yy*size+xx;if(mask[q])flux+=concentration[q]-c}
  next[k]=c+alpha*flux;
 }
 return next;
}
export function initializePulse(domain,{x=0,y=0,width=.18}={}){
 if(!Number.isFinite(width)||width<=0)throw Error('Invalid pulse width');
 const {size,extent,dx,mask}=domain,result=new Float64Array(mask.length);
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){const k=j*size+i;if(mask[k])result[k]=Math.exp(-((i*dx-extent-x)**2+(j*dx-extent-y)**2)/(2*width**2))}
 return result;
}
export function totalMass(field,domain){let sum=0;for(let i=0;i<field.length;i++)if(domain.mask[i])sum+=field[i];return sum}
