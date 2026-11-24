import {mesh,project,saddlePlaneIntersection} from "./geometry3d.mjs";
const canvas=document.getElementById("geometryPlot"),kind=document.getElementById("geometryKind"),time=document.getElementById("geometryTime"),caption=document.getElementById("geometryInfo");
let yaw=.65,pitch=.55,drag=false,lastX=0,lastY=0;
function render(){
 const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle="#0b1629";ctx.fillRect(0,0,w,h);
 const scene=kind.value,options={yaw,pitch,width:w,height:h,scale:Math.min(w/5,125)};
 const m=mesh(scene==="intersection"?"saddle":scene,{steps:24,time:Number(time.value)});
 ctx.strokeStyle="#57bbef";ctx.lineWidth=1;ctx.beginPath();for(const [a,b] of m.lines){const p=project(m.vertices[a],options),q=project(m.vertices[b],options);ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y)}ctx.stroke();
 if(scene==="intersection"){ctx.strokeStyle="#ffca75";ctx.lineWidth=4;for(const curve of saddlePlaneIntersection()){ctx.beginPath();curve.forEach((v,i)=>{const p=project(v,options);if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)});ctx.stroke()}}
 caption.textContent=({saddle:"Гиперболический параболоид z=x²−y².",plane:"Плоскость z=0.",wave:"Демонстрационная волновая поверхность z=sin(πx)sin(πy)cos(t).",cone:"Параметрический конус.",intersection:"Пересечение z=x²−y² и z=0: прямые y=±x (жёлтые). Это точное алгебраическое пересечение."})[scene];
}
canvas.addEventListener("pointerdown",e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(!drag)return;yaw+=(e.clientX-lastX)*.009;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-lastY)*.009));lastX=e.clientX;lastY=e.clientY;render()});
canvas.addEventListener("pointerup",()=>drag=false);canvas.addEventListener("pointercancel",()=>drag=false);
kind.addEventListener("change",render);time.addEventListener("input",render);render();
