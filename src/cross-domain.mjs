// Cross-domain laboratory: explicit adapters, deterministic simulation, no forecasts implied.
export const modelCatalog=Object.freeze({
 landau:{label:"Амплитудная модель Ландау",equation:"da/dt = μa − βa³ + κu(t)",parameters:{mu:.35,beta:1,kappa:.6},kind:"forced-ode"},
 logistic:{label:"Логистическое отображение",equation:"a[n+1] = r a[n](1−a[n]) + κu[n]",parameters:{r:3.6,kappa:.05},kind:"discrete-map"}
});
export function normalizeSeries(values){
 if(!Array.isArray(values)||values.length<8||values.length>20000||values.some(v=>typeof v!=="number"||!Number.isFinite(v)))throw Error("Ожидается 8–20000 конечных чисел");
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 const sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length);
 if(sd<1e-12)throw Error("Невозможно нормализовать постоянный ряд");
 return {values:values.map(v=>(v-mean)/sd),mean,sd};
}
export function simulateOverlay(values,{model="landau",mode="simulate",window=500,dt=.05,parameters={}}={}){
 if(!modelCatalog[model])throw Error("Неизвестная модель");
 if(!["simulate","transform"].includes(mode))throw Error("Подгонка параметров пока не реализована");
 if(!Number.isInteger(window)||window<8||window>2000||!Number.isFinite(dt)||dt<=0||dt>.25)throw Error("Недопустимые параметры расчёта");
 const raw=values.slice(-window),normalized=normalizeSeries(raw),u=normalized.values;
 const defaults=modelCatalog[model].parameters,p={...defaults,...parameters};
 if(Object.keys(parameters).some(k=>!(k in defaults))||Object.values(p).some(v=>!Number.isFinite(v)||Math.abs(v)>20))throw Error("Недопустимые параметры модели");
 const output=new Array(u.length);let a=model==="logistic"?.5:0;
 for(let i=0;i<u.length;i++){
  output[i]=a;
  if(model==="landau"){
   const force=p.kappa*u[i];
   const f=x=>p.mu*x-p.beta*x*x*x+force;
   const k1=f(a),k2=f(a+dt*k1/2),k3=f(a+dt*k2/2),k4=f(a+dt*k3);
   a+=dt*(k1+2*k2+2*k3+k4)/6;
  }else a=p.r*a*(1-a)+p.kappa*u[i];
  if(!Number.isFinite(a)||Math.abs(a)>1e6)throw Error("Модель численно неустойчива при выбранных параметрах");
 }
 return {input:raw,normalized:u,output,model,mode,parameters:p,metadata:{mean:normalized.mean,sd:normalized.sd,dt,window:u.length,interpretation:"Демонстрационная вынужденная модель, не прогноз и не доказательство связи с данными"}};
}
export function syntheticSeries(n=500){if(!Number.isInteger(n)||n<8||n>2000)throw Error("Недопустимый размер");return Array.from({length:n},(_,i)=>Math.sin(i*.09)+.35*Math.sin(i*.23)+.001*i)}
export function parseSeriesCsv(text){
 if(typeof text!=="string"||text.length>500000)throw Error("Файл слишком велик");
 const lines=text.trim().split(/\r?\n/);if(lines.length>20001)throw Error("Слишком много строк");
 const values=[];
 for(const line of lines){const cell=line.trim().split(/[;,\t]/).at(-1)?.trim();if(!cell)continue;const n=Number(cell);if(Number.isFinite(n))values.push(n)}
 if(values.length<8)throw Error("CSV должен содержать не менее восьми числовых значений в последнем столбце");
 return values;
}
