import {compileImplicit,implicitPoints} from "./implicit3d.mjs";
import {project} from "./geometry3d.mjs";
import {isosurface} from "./isosurface.mjs";
const input=document.getElementById("equationInput"),second=document.getElementById("equationSecond"),button=document.getElementById("equationRender"),canvas=document.getElementById("equationPlot"),status=document.getElementById("equationStatus");
let yaw=.6,pitch=.45,down=false,lastX=0,lastY=0,clouds=[],meshes=[];
function draw(){
 const c=canvas.getContext("2d"),w=canvas.width,h=canvas.height;c.fillStyle="#0b1629";c.fillRect(0,0,w,h);
 meshes.forEach((triangles,index)=>{c.strokeStyle=index?"#ffbd79":"#63d4f4";c.lineWidth=.65;c.beginPath();for(const tri of triangles){const p=tri.map(v=>project(v,{yaw,pitch,width:w,height:h,scale:110}));c.moveTo(p[0].x,p[0].y);c.lineTo(p[1].x,p[1].y);c.lineTo(p[2].x,p[2].y);c.closePath()}c.stroke()});
 clouds.forEach((cloud,index)=>{c.fillStyle=index?"#ffbd79":"#63d4f4";for(const point of cloud){const p=project(point,{yaw,pitch,width:w,height:h,scale:110});c.fillRect(p.x,p.y,2.2,2.2)}});
}
function update(){
 try{const equations=[input.value,second.value.trim()].filter(Boolean);const funcs=equations.map(compileImplicit);const next=funcs.map(f=>implicitPoints(f,{steps:22,threshold:.09}));const nextMeshes=funcs.map(f=>isosurface(f,{steps:20}));clouds=next;meshes=nextMeshes;status.textContent=`Построено: ${nextMeshes.map(p=>p.length).join(" / ")} треугольников. Цвета соответствуют уравнениям. Пересечения двух облаков пока не вычисляются отдельно.`;draw()}
 catch(e){status.textContent="Ошибка уравнения: "+e.message}
}
button.addEventListener("click",update);
canvas.addEventListener("pointerdown",e=>{down=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(!down)return;yaw+=(e.clientX-lastX)*.008;pitch=Math.max(-1.45,Math.min(1.45,pitch+(e.clientY-lastY)*.008));lastX=e.clientX;lastY=e.clientY;draw()});
canvas.addEventListener("pointerup",()=>down=false);canvas.addEventListener("pointercancel",()=>down=false);update();
