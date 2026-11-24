// Approximate the common zero set by checking a pair of continuous scalar fields
// on a uniform grid. Returns cell centers with bounded residuals, not an exact curve.
export function intersectionPoints(f,g,{steps=36,extent=1.5,tolerance=.12}={}){
 if(!Number.isInteger(steps)||steps<4||steps>64||!Number.isFinite(extent)||extent<=0||!Number.isFinite(tolerance)||tolerance<=0)throw Error("Invalid intersection settings");
 const result=[];
 for(let i=0;i<=steps;i++)for(let j=0;j<=steps;j++)for(let k=0;k<=steps;k++){
  const x=extent*(2*i/steps-1),y=extent*(2*j/steps-1),z=extent*(2*k/steps-1);
  const a=f(x,y,z),b=g(x,y,z);
  if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=tolerance&&Math.abs(b)<=tolerance)result.push({x,y,z,residual:Math.max(Math.abs(a),Math.abs(b))});
 }
 return result;
}
