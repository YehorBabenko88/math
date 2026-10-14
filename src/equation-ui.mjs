import {compileImplicit,implicitPoints} from "./implicit3d.mjs";
import {project} from "./geometry3d.mjs";
import {isosurface} from "./isosurface.mjs";
import {intersectionPoints} from "./intersections3d.mjs";
const input=document.getElementById("equationInput"),second=document.getElementById("equationSecond"),button=document.getElementById("equationRender"),canvas=document.getElementById("equationPlot"),status=document.getElementById("equationStatus");
let yaw=.6,pitch=.45,down=false,lastX=0,lastY=0,clouds=[],meshes=[],crossings=[];
function draw(){
 const c=canvas.getContext("2d"),w=canvas.width,h=canvas.height;c.fillStyle="#0b1629";c.fillRect(0,0,w,h);
 const opacity=Number(document.getElementById("surfaceOpacity").value);
 // Painter's algorithm: back-to-front triangle sorting in view space.
 const faces=[];
 meshes.forEach((tris,index)=>{for(const tri of tris){const pts=tri.map(v=>project(v,{yaw,pitch,width:w,height:h,scale:110}));faces.push({pts,index,depth:pts.reduce((a,p)=>a+p.depth,0)/3})}});
 faces.sort((a,b)=>a.depth-b.depth);
 for(const {pts,index} of faces){c.beginPath();c.moveTo(pts[0].x,pts[0].y);c.lineTo(pts[1].x,pts[1].y);c.lineTo(pts[2].x,pts[2].y);c.closePath();c.fillStyle=index?"rgba(255,189,121,"+opacity*.35+")":"rgba(99,212,244,"+opacity*.35+")";c.strokeStyle=index?"rgba(255,189,121,.45)":"rgba(99,212,244,.45)";c.lineWidth=.45;c.fill();c.stroke()}
 if(document.getElementById("showIntersections").checked){c.fillStyle="#ff4c8b";for(const v of crossings){const p=project(v,{yaw,pitch,width:w,height:h,scale:110});c.fillRect(p.x-2,p.y-2,4,4)}}
}

function update(){
 try{const equations=[input.value,second.value.trim()].filter(Boolean);const funcs=equations.map(compileImplicit);const next=funcs.map(f=>implicitPoints(f,{steps:22,threshold:.09}));const nextMeshes=funcs.map(f=>isosurface(f,{steps:20}));clouds=next;meshes=nextMeshes;crossings=funcs.length===2?intersectionPoints(funcs[0],funcs[1],{steps:36,tolerance:.1}):[];status.textContent=`Построено: ${nextMeshes.map(p=>p.length).join(" / ")} треугольников; ${crossings.length} приближённых точек пересечения. Цвета соответствуют уравнениям. Пересечения двух облаков пока не вычисляются отдельно.`;draw()}
 catch(e){status.textContent="Ошибка уравнения: "+e.message}
}
button.addEventListener("click",update);
canvas.addEventListener("pointerdown",e=>{down=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(!down)return;yaw+=(e.clientX-lastX)*.008;pitch=Math.max(-1.45,Math.min(1.45,pitch+(e.clientY-lastY)*.008));lastX=e.clientX;lastY=e.clientY;draw()});
canvas.addEventListener("pointerup",()=>down=false);canvas.addEventListener("pointercancel",()=>down=false);update();

for(const id of ["surfaceOpacity","showIntersections"])document.getElementById(id).addEventListener("input",draw);
document.getElementById("cameraReset").addEventListener("click",()=>{yaw=.6;pitch=.45;draw()});
