import {exact} from './scientific-data.mjs';
import {unitSpec,sameDimensions} from './scientific-units.mjs';
export const OPERATION_PORTS=Object.freeze(Object.fromEntries(Object.entries({
 sum:{inputs:['a','b'],outputs:['value']},
 'rolling-mean':{inputs:['x'],outputs:['value']},derivative:{inputs:['x'],outputs:['value']},integral:{inputs:['x'],outputs:['value']},
 model:{inputs:['x'],outputs:['value']},
 overlay:{inputs:['a','b'],outputs:['value','reference']},compare:{inputs:['a','b'],outputs:['value','absolute','rmse','mae','bias']}
}).map(([kind,p])=>[kind,Object.freeze({inputs:Object.freeze(p.inputs),outputs:Object.freeze(p.outputs)})])));
const finite=x=>{if(!Number.isFinite(x))throw Error('NONFINITE_OPERATION');return x;};
const datum=(a,values,{unit=a.unit,timestamps=a.timestamps,availableAt=a.availableAt,type=a.type}={})=>({type,unit,values,timestamps:[...timestamps],availableAt:[...availableAt]});
function aligned(a,b){if(a.type!==b.type||a.unit!==b.unit||a.values.length!==b.values.length||a.timestamps.some((t,i)=>t!==b.timestamps[i]))throw Error('MISALIGNED_INPUTS_OR_UNITS');}
const dimensions=(a,b)=>{if(!sameDimensions(a,b))throw Error('OUTPUT_DIMENSION_MISMATCH');};
// Only fixed mathematical adapters; no user code, fitting, data IO or centered windows.
export function evaluateScientificOperation(n,args,reserve){
 const a=args[0],len=a.values.length;
 if(n.kind==='model'){
  exact(n,['id','kind','model','parameters']);const p=n.parameters;let map,unit=a.unit;
  if(n.model==='affine'){
   exact(p,['gain','offset']);if(!Number.isFinite(p.gain)||!Number.isFinite(p.offset)||Math.abs(p.gain)>1e6||Math.abs(p.offset)>1e6)throw Error('INVALID_MODEL_PARAMETERS');
   map=x=>finite(finite(x*p.gain)+p.offset);
  }else{
   const u=unitSpec(a.unit);dimensions(u.dimensions,Array(10).fill(0));unit='dimensionless';
   if(n.model==='landau-map'){
    exact(p,['mu','beta']);if(!Number.isFinite(p.mu)||!Number.isFinite(p.beta)||Math.abs(p.mu)>100||p.beta<0||p.beta>100)throw Error('INVALID_MODEL_PARAMETERS');
    map=v=>{const x=finite(v*u.factor),linear=finite(x+finite(p.mu*x)),cube=finite(finite(x*x)*x);return finite(linear-finite(p.beta*cube));};
   }else if(n.model==='logistic-map'){
    exact(p,['r']);if(!Number.isFinite(p.r)||p.r<0||p.r>4)throw Error('INVALID_MODEL_PARAMETERS');
    map=v=>{const x=finite(v*u.factor);return finite(finite(p.r*x)*finite(1-x));};
   }else throw Error('UNKNOWN_MODEL');
  }
  reserve(len*8);return {value:datum(a,a.values.map(map),{unit})};
 }
 if(n.kind==='rolling-mean'){
  exact(n,['id','kind','window']);if(a.type!=='series'||!Number.isSafeInteger(n.window)||n.window<1||n.window>len)throw Error('INVALID_WINDOW');
  const count=len-n.window+1;reserve(count*n.window);const values=[],availableAt=[];
  for(let i=n.window-1;i<len;i++){let mean=0,available=0;for(let j=i-n.window+1;j<=i;j++){mean=finite(mean+a.values[j]/n.window);available=Math.max(available,a.availableAt[j]);}values.push(mean);availableAt.push(available);}
  return {value:datum(a,values,{timestamps:a.timestamps.slice(n.window-1),availableAt})};
 }
 if(n.kind==='derivative'||n.kind==='integral'){
  exact(n,['id','kind','outputUnit']);if(a.type!=='series'||len<2)throw Error('SERIES_REQUIRED');const input=unitSpec(a.unit),output=unitSpec(n.outputUnit),sign=n.kind==='derivative'?-1:1;
  dimensions(input.dimensions.map((v,i)=>v+(i===2?sign:0)),output.dimensions);reserve(len*8);
  const values=n.kind==='integral'?[0]:[],availability=n.kind==='integral'?[a.availableAt[0]]:[];let sum=0,available=a.availableAt[0];
  for(let i=1;i<len;i++){
   const seconds=finite((a.timestamps[i]-a.timestamps[i-1])/1000);if(seconds<=0)throw Error('INVALID_TIME_AXIS');
   const previous=finite(a.values[i-1]*input.factor),current=finite(a.values[i]*input.factor);
   if(n.kind==='derivative')values.push(finite(finite(finite(current-previous)/seconds)/output.factor));
   else{const area=finite(finite(previous/2+current/2)*seconds);sum=finite(sum+area);values.push(finite(sum/output.factor));}
   available=n.kind==='integral'?Math.max(available,a.availableAt[i]):Math.max(a.availableAt[i-1],a.availableAt[i]);availability.push(available);
  }
  return {value:datum(a,values,{unit:n.outputUnit,timestamps:n.kind==='derivative'?a.timestamps.slice(1):a.timestamps,availableAt:availability})};
 }
 const b=args[1];exact(n,['id','kind']);aligned(a,b);const availability=a.availableAt.map((v,i)=>Math.max(v,b.availableAt[i]));
 if(n.kind==='overlay'){
  if(a.type!=='series')throw Error('SERIES_REQUIRED');reserve(len*2);return {value:datum(a,[...a.values],{availableAt:availability}),reference:datum(b,[...b.values],{availableAt:availability})};
 }
 if(n.kind==='sum'){reserve(len);return {value:datum(a,a.values.map((v,i)=>finite(v+b.values[i])),{availableAt:availability})};}
 if(n.kind!=='compare')throw Error('UNKNOWN_OPERATION');
 reserve(len*8);const diff=a.values.map((v,i)=>finite(v-b.values[i])),absolute=diff.map(Math.abs),max=Math.max(...absolute);
 const rmse=max===0?0:finite(max*Math.sqrt(absolute.reduce((s,v)=>s+(v/max)**2,0)/len));
 const mean=xs=>finite(xs.reduce((s,v)=>finite(s+v/len),0));
 const metrics={rmse,mae:mean(absolute),bias:mean(diff)};
 const scalar=value=>datum(a,[value],{type:'scalar',timestamps:[a.timestamps.at(-1)],availableAt:[Math.max(a.timestamps.at(-1),...availability)]});
 return {value:datum(a,diff,{availableAt:availability}),absolute:datum(a,absolute,{availableAt:availability}),...Object.fromEntries(Object.entries(metrics).map(([port,value])=>[port,scalar(value)]))};
}
