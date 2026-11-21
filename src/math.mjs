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
// Opt-in checked wrapper: legacy evaluateFunction() remains unchanged.
export function evaluateFunctionFinite(kind,x,p){
 const finite=v=>{if(!Number.isFinite(v))throw Error('NONFINITE_METHOD');return v;};finite(x);finite(p);
 if(kind==='polynomial'){const square=finite(x*x);finite(square*x);finite(p*x);}
 else if(kind==='sine')finite(p*x);
 else if(kind==='gaussian')finite(finite(-p*x)*x);
 else throw Error('UNKNOWN_METHOD');
 return finite(evaluateFunction(kind,x,p));
}
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
// Opt-in diagnostics: roots() above deliberately retains its legacy behavior.
export function rootsWithDiagnostics(coefficients,{maxIterations=500,tolerance=1e-9,residualTolerance=tolerance}={}){
 const coeffs=Array.from(coefficients);
 if(coeffs.length<2||coeffs.some(x=>!Number.isFinite(x))||coeffs[0]===0)throw Error('Expected finite polynomial coefficients in descending order with a nonzero leading coefficient');
 if(!Number.isSafeInteger(maxIterations)||maxIterations<0||!Number.isFinite(tolerance)||tolerance<=0||!Number.isFinite(residualTolerance)||residualTolerance<0)throw RangeError('Expected nonnegative integer maxIterations, positive finite tolerance and nonnegative finite residualTolerance');
 const normalized=coeffs.map(x=>x/coeffs[0]),n=coeffs.length-1;
 const finite=z=>Number.isFinite(z.re)&&Number.isFinite(z.im);
 function measure(zs){
  if(zs.length!==n||!zs.every(finite))return{maxResidual:null,maxNormalizedResidual:null};
  let raw=0,norm=0;
  for(const z of zs){const p=evaluatePolynomial(coeffs,z),q=evaluatePolynomial(normalized,z);raw=Math.max(raw,Math.hypot(p.re,p.im));norm=Math.max(norm,Math.hypot(q.re,q.im));}
  return{maxResidual:Number.isFinite(raw)?raw:null,maxNormalizedResidual:Number.isFinite(norm)?norm:null};
 }
 const accepted=s=>s.maxResidual!==null&&s.maxNormalizedResidual!==null&&s.maxResidual<=residualTolerance&&s.maxNormalizedResidual<=residualTolerance;
 const finish=(reason,zs,iterations,stats=measure(zs))=>({roots:zs.map(z=>({re:z.re,im:z.im})),converged:reason==='CONVERGED',iterations,...stats,reason});
 if(normalized.some(x=>!Number.isFinite(x)))return finish('NON_FINITE',[],0);
 if(normalized.some((x,i)=>x===0&&coeffs[i]!==0))return finish('NORMALIZATION_UNDERFLOW',[],0);
 if(n===1){const zs=[{re:-normalized[1],im:0}],stats=measure(zs);return finish(stats.maxResidual===null||stats.maxNormalizedResidual===null?'NON_FINITE':accepted(stats)?'CONVERGED':'RESIDUAL_NOT_MET',zs,0,stats);}
 let radius=1;for(const c of normalized.slice(1))radius=Math.max(radius,1+Math.abs(c));
 let zs=Array.from({length:n},(_,i)=>({re:radius*Math.cos(2*Math.PI*(i+.17)/n),im:radius*Math.sin(2*Math.PI*(i+.17)/n)}));
 if(!zs.every(finite))return finish('NON_FINITE',[],0);
 for(let iteration=1;iteration<=maxIterations;iteration++){
  let worst=0,changed=false;const next=[];
  for(let i=0;i<n;i++){
   let denominator={re:1,im:0};for(let j=0;j<n;j++)if(i!==j)denominator=mul(denominator,sub(zs[i],zs[j]));
   const value=evaluatePolynomial(normalized,zs[i]);
   const divisor=denominator.re*denominator.re+denominator.im*denominator.im;
   const numerator={re:value.re*denominator.re+value.im*denominator.im,im:value.im*denominator.re-value.re*denominator.im};
   if(!finite(value)||!finite(denominator)||!Number.isFinite(divisor)||divisor===0||!finite(numerator))return finish('NON_FINITE',zs,iteration);
   const delta={re:numerator.re/divisor,im:numerator.im/divisor},z=sub(zs[i],delta);
   if(!finite(delta)||!finite(z))return finish('NON_FINITE',zs,iteration);
   worst=Math.max(worst,Math.hypot(delta.re,delta.im));changed ||= z.re!==zs[i].re||z.im!==zs[i].im;next.push(z);
  }
  zs=next;const stats=measure(zs);
  if(!Number.isFinite(worst)||stats.maxResidual===null||stats.maxNormalizedResidual===null)return finish('NON_FINITE',zs,iteration,stats);
  if(worst<tolerance&&accepted(stats))return finish('CONVERGED',zs,iteration,stats);
  if(!changed)return finish('STAGNATION',zs,iteration,stats);
 }
 return finish('MAX_ITERATIONS',zs,maxIterations);
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
