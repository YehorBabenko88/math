import {fromUnit} from './si-dimensions.mjs';
import {compileExpression} from './expression.mjs';
const zero=()=>Array(10).fill(0);
export function unitSpec(name){
 if(['USD','USDT','BTC'].includes(name)){const dimensions=zero();dimensions[7+['USD','USDT','BTC'].indexOf(name)]=1;return {name,factor:1,dimensions};}
 const q=fromUnit(1,name==='dimensionless'?'1':name);return {name,factor:q.siValue,dimensions:[...q.dimensions,0,0,0]};
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
