export const intersect=(a,b)=>[...a].filter(x=>b.has(x));
export const union=(a,b)=>new Set([...a,...b]);
export const difference=(a,b)=>[...a].filter(x=>!b.has(x));
export const symmetricDifference=(a,b)=>[...union(a,b)].filter(x=>a.has(x)!==b.has(x));
export const membership=(value,a,b)=>({inA:a.has(value),inB:b.has(value),inIntersection:a.has(value)&&b.has(value)});
export const evaluateFunction=(kind,x,p)=>({
 polynomial:()=>x*x*x-p*x,
 sine:()=>Math.sin(p*x),
 gaussian:()=>Math.exp(-p*x*x)
}[kind]?.()??NaN);
export const examples=Object.freeze({
 polynomial:{formula:"f(x) = x³ − a·x",details:"Точки пересечения с осью x — решения f(x)=0. Меняй a, чтобы увидеть перестройку корней."},
 sine:{formula:"f(x) = sin(a·x)",details:"Параметр a меняет частоту колебаний. Период при a ≠ 0 равен 2π/|a|."},
 gaussian:{formula:"f(x) = exp(−a·x²)",details:"При a > 0 колокол сужается с ростом a; при a < 0 функция неограниченно возрастает при |x|→∞."}
});
export function evaluatePolynomial(coeffs,z){let a={re:0,im:0};for(const c of coeffs){a={re:a.re*z.re-a.im*z.im+c,im:a.re*z.im+a.im*z.re}}return a}
const mul=(a,b)=>({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
const sub=(a,b)=>({re:a.re-b.re,im:a.im-b.im});
const div=(a,b)=>{const d=b.re*b.re+b.im*b.im;return {re:(a.re*b.re+a.im*b.im)/d,im:(a.im*b.re-a.re*b.im)/d}};
export function roots(coefficients,{maxIterations=500,tolerance=1e-9}={}){
 if(coefficients.length<2||coefficients.some(x=>!Number.isFinite(x))||coefficients[0]===0)throw Error("Expected polynomial coefficients in descending order with a nonzero leading coefficient");
 const n=coefficients.length-1,normalized=coefficients.map(x=>x/coefficients[0]);
 if(n===1)return [{re:-normalized[1],im:0}];
 const r=1+Math.max(...normalized.slice(1).map(Math.abs));
 let zs=Array.from({length:n},(_,i)=>({re:r*Math.cos(2*Math.PI*(i+.17)/n),im:r*Math.sin(2*Math.PI*(i+.17)/n)}));
 for(let iter=0;iter<maxIterations;iter++){
  let worst=0;
  const next=zs.map((z,i)=>{let d={re:1,im:0};for(let j=0;j<n;j++)if(i!==j)d=mul(d,sub(z,zs[j]));
   const delta=div(evaluatePolynomial(normalized,z),d);worst=Math.max(worst,Math.hypot(delta.re,delta.im));return sub(z,delta)});
  zs=next;
  if(worst<tolerance)break;
 }
 return zs;
}
export function sampleBitcoinIllustration(){
 return [64,66,65,70,73,71,76,74].map((y,i)=>({x:i,y}));
}
export function observationsToCoefficients(values){
 if(values.length<2||values.length>16||values.some(x=>!Number.isFinite(x)))throw Error("Expected 2–16 finite observations");
 const min=Math.min(...values),max=Math.max(...values),scale=Math.max(1,max-min);
 // Explicit illustrative mapping: normalized observations serve as coefficients of a monic polynomial.
 return [1,...values.map(v=>(v-min)/scale-.5)];
}
export const sceneDefinitions=[
 {id:"sets",name:"Множества",description:"Пересечения, объединения и принадлежность"},
 {id:"functions",name:"Функции",description:"Графики и параметры"},
 {id:"roots",name:"Рынок → корни",description:"Экспериментальные преобразования рядов"}
];
