import {bookScenes,sampleScene} from "./book-scenes.mjs";
const $=id=>document.getElementById(id);
const select=$("bookScene"),compare=$("compareScene"),time=$("sceneTime"),play=$("playScene"),canvas=$("bookPlot"),info=$("bookInfo");
select.innerHTML=bookScenes.map(s=>`<option value="${s.id}">${s.title} — ${s.book.split(",")[0]}</option>`).join("");
compare.innerHTML='<option value="">Без сравнения</option>'+bookScenes.map(s=>`<option value="${s.id}">${s.title}</option>`).join("");
let running=false,previous=0;
function render(){
 const ids=[select.value,compare.value].filter(Boolean),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);ctx.fillStyle="#0b1629";ctx.fillRect(0,0,w,h);
 ctx.strokeStyle="#435570";ctx.beginPath();ctx.moveTo(38,h/2);ctx.lineTo(w-12,h/2);ctx.moveTo(38,12);ctx.lineTo(38,h-12);ctx.stroke();
 const t=Number(time.value);
 ids.forEach((id,j)=>{const pts=sampleScene(id,t);ctx.strokeStyle=["#5ad6f3","#ffbd79"][j];ctx.lineWidth=3;ctx.beginPath();pts.forEach((p,i)=>{const x=38+p.x*(w-55),y=h/2-p.y*(h*.38);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke()});
 info.textContent=ids.map((id,j)=>{const s=bookScenes.find(s=>s.id===id);return `${j===0?"Основная":"Сравнение"}: ${s.title}. ${s.equation}. ${s.description} Источник: ${s.source}, печатная с. ${s.page}.`}).join("\n\n");
 $("sceneTimeValue").textContent=t.toFixed(2);
}
function frame(now){if(!running)return;if(previous){time.value=((Number(time.value)+(now-previous)/1000*.35)%4).toFixed(2)}previous=now;render();requestAnimationFrame(frame)}
play.addEventListener("click",()=>{running=!running;play.textContent=running?"Пауза":"Воспроизвести";previous=0;if(running)requestAnimationFrame(frame)});
for(const el of [select,compare,time])el.addEventListener("input",render);
render();
