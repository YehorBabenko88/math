import {fromUnit} from './si-dimensions.mjs';
import {compileExpression} from './expression.mjs';
const zero=()=>Array(10).fill(0);
function atomicUnit(name){
 if(['USD','USDT','BTC'].includes(name)){const dimensions=zero();dimensions[7+['USD','USDT','BTC'].indexOf(name)]=1;return {name,factor:1,dimensions};}
 if(['cm','mm','ms'].includes(name)){const base=name==='ms'?'s':'m',q=fromUnit(1,base);return {name,factor:name==='cm'?.01:.001,dimensions:[...q.dimensions,0,0,0]};}
 const q=fromUnit(1,name==='dimensionless'?'1':name);return {name,factor:q.siValue,dimensions:[...q.dimensions,0,0,0]};
}
export function unitSpec(name){
 if(typeof name!=='string'||name.length<1||name.length>96)throw Error('INVALID_UNIT');
 try{return atomicUnit(name);}catch{}
 const parts=name.split(/([*/])/);if(parts.length>15||parts.length%2!==1)throw Error('UNIT_COMPLEXITY');
 let factor=1,dimensions=zero();
 for(let i=0;i<parts.length;i+=2){
  const m=/^([A-Za-z]+|1)(?:\^(-?[1-8]))?$/.exec(parts[i]);if(!m)throw Error('INVALID_COMPOUND_UNIT');
  const u=atomicUnit(m[1]),exponent=Number(m[2]??1)*(i&&parts[i-1]==='/'?-1:1),scale=u.factor**exponent;
  factor*=scale;dimensions=dimensions.map((x,j)=>x+exponent*u.dimensions[j]);
  if(!Number.isFinite(factor)||factor<=0||dimensions.some(x=>Math.abs(x)>16))throw Error('UNIT_COMPLEXITY');
 }
 return {name,factor,dimensions};
}
export const sameDimensions=(a,b)=>a.every((x,i)=>x===b[i]);
export function compileDimensionalFormula(expression,inputUnit,outputUnit){
 if(typeof expression!=='string'||expression.length<1||expression.length>160)throw Error('FORMULA_LIMIT');
 const fn=compileExpression(expression),input=unitSpec(inputUnit),output=unitSpec(outputUnit);let cost=0;
 function infer(a){
  cost++;if(a.type==='number'){if(!Number.isFinite(a.value))throw Error('NONFINITE_LITERAL');return zero();}
  if(a.type==='symbol')return a.name==='x'?input.dimensions:zero();
  if(a.type==='neg')return infer(a.arg);
  if(a.type==='call'){
   const d=infer(a.arg);if(a.name==='abs')return d;
   if(a.name==='sqrt'){if(d.some(x=>x%2!==0))throw Error('FRACTIONAL_DIMENSIONS');return d.map(x=>x/2);}
   if(!sameDimensions(d,zero()))throw Error('DIMENSIONLESS_ARGUMENT_REQUIRED');return zero();
  }
  const l=infer(a.left),r=infer(a.right);
  if(a.op==='+'||a.op==='-'){if(!sameDimensions(l,r))throw Error('INCOMPATIBLE_DIMENSIONS');return l;}
  if(a.op==='*'||a.op==='/')return l.map((x,i)=>x+(a.op==='*'?1:-1)*r[i]);
  if(!sameDimensions(r,zero()))throw Error('DIMENSIONAL_EXPONENT');
  if(sameDimensions(l,zero()))return zero();
  const n=a.right.type==='number'?a.right.value:a.right.type==='neg'&&a.right.arg.type==='number'?-a.right.arg.value:NaN;
  if(!Number.isInteger(n)||Math.abs(n)>16)throw Error('CONSTANT_INTEGER_EXPONENT_REQUIRED');return l.map(x=>x*n);
 }
 if(!sameDimensions(infer(fn.ast),output.dimensions))throw Error('OUTPUT_DIMENSION_MISMATCH');
 return {cost,evaluate(value){const x=value*input.factor;if(!Number.isFinite(x))throw Error('NONFINITE_CONVERSION');const result=fn.evaluateFinite(x)/output.factor;if(!Number.isFinite(result))throw Error('NONFINITE_FORMULA_RESULT');return result;}};
}
