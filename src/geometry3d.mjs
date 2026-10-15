export function surfacePoint(kind,u,v,t=0){
 if(![u,v,t].every(Number.isFinite))throw Error("Non-finite parameter");
 switch(kind){
 case "saddle":return {x:u,y:v,z:u*u-v*v};
 case "plane":return {x:u,y:v,z:0};
 case "wave":return {x:u,y:v,z:Math.sin(Math.PI*u)*Math.sin(Math.PI*v)*Math.cos(t)};
 case "cone":return {x:u*Math.cos(v),y:u*Math.sin(v),z:u};
 default:throw Error("Unknown surface");
 }
}
export function project(p,{yaw=.6,pitch=.5,scale=95,width=800,height=430}={}){
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const x=p.x*cy-p.y*sy,y=p.x*sy+p.y*cy;
 return {x:width/2+scale*x,y:height/2-scale*(p.z*cp-y*sp),depth:p.z*sp+y*cp};
}
export function mesh(kind,{steps=22,time=0}={}){
 if(!Number.isInteger(steps)||steps<2||steps>120)throw Error("Invalid steps");
 const vertices=[];for(let i=0;i<=steps;i++)for(let j=0;j<=steps;j++){const u=-1+2*i/steps,v=kind==="cone"?2*Math.PI*j/steps:-1+2*j/steps;vertices.push(surfacePoint(kind,u,v,time))}
 const lines=[];for(let i=0;i<=steps;i++)for(let j=0;j<=steps;j++){const k=i*(steps+1)+j;if(i<steps)lines.push([k,k+steps+1]);if(j<steps)lines.push([k,k+1])}
 return {vertices,lines};
}
export function saddlePlaneIntersection(samples=101){
 if(!Number.isInteger(samples)||samples<2||samples>1000)throw Error("Invalid samples");
 return [-1,1].map(sign=>Array.from({length:samples},(_,i)=>{const x=-1+2*i/(samples-1);return {x,y:sign*x,z:0}}));
}
