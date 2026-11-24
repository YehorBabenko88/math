// Isosurface reconstruction by marching tetrahedra (no external dependencies).
const TETS=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const OFFSETS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
function interpolate(a,b,va,vb){const t=Math.max(0,Math.min(1,Math.abs(va-vb)<1e-14?.5:va/(va-vb)));return {x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y),z:a.z+t*(b.z-a.z)}}
export function isosurface(f,{steps=20,extent=1.5,level=0}={}){
 if(!Number.isInteger(steps)||steps<3||steps>48||!Number.isFinite(extent)||extent<=0||!Number.isFinite(level))throw Error("Invalid isosurface settings");
 const triangles=[],n=steps+1,stride=n*n,grid=new Array(n*n*n);
 const index=(i,j,k)=>i*stride+j*n+k;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
 const p={x:extent*(2*i/steps-1),y:extent*(2*j/steps-1),z:extent*(2*k/steps-1)},v=f(p.x,p.y,p.z)-level;
 grid[index(i,j,k)]={p,v};
 }
 for(let i=0;i<steps;i++)for(let j=0;j<steps;j++)for(let k=0;k<steps;k++){
 const cube=OFFSETS.map(([di,dj,dk])=>grid[index(i+di,j+dj,k+dk)]);
 for(const tet of TETS){
 const vertices=tet.map(q=>cube[q]),inside=vertices.filter(x=>Number.isFinite(x.v)&&x.v<0),outside=vertices.filter(x=>Number.isFinite(x.v)&&x.v>=0);
 if(!inside.length||!outside.length||inside.length+outside.length!==4)continue;
 const edge=(a,b)=>interpolate(a.p,b.p,a.v,b.v);
 if(inside.length===1){const a=inside[0];triangles.push([edge(a,outside[0]),edge(a,outside[1]),edge(a,outside[2])])}
 else if(inside.length===3){const a=outside[0];triangles.push([edge(a,inside[0]),edge(a,inside[2]),edge(a,inside[1])])}
 else{const [a,b]=inside,[c,d]=outside;const ac=edge(a,c),ad=edge(a,d),bc=edge(b,c),bd=edge(b,d);triangles.push([ac,ad,bc],[bc,ad,bd])}
 }
 }
 return triangles;
}
