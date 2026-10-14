// Seven SI base dimensions: length, mass, time, current, temperature, amount, luminous intensity.
const BASE=['m','kg','s','A','K','mol','cd'];
const UNITS={
 '1':{factor:1,d:[0,0,0,0,0,0,0]},m:{factor:1,d:[1,0,0,0,0,0,0]},km:{factor:1000,d:[1,0,0,0,0,0,0]},
 s:{factor:1,d:[0,0,1,0,0,0,0]},min:{factor:60,d:[0,0,1,0,0,0,0]},h:{factor:3600,d:[0,0,1,0,0,0,0]},
 kg:{factor:1,d:[0,1,0,0,0,0,0]},g:{factor:0.001,d:[0,1,0,0,0,0,0]},
 A:{factor:1,d:[0,0,0,1,0,0,0]},K:{factor:1,d:[0,0,0,0,1,0,0]},mol:{factor:1,d:[0,0,0,0,0,1,0]},cd:{factor:1,d:[0,0,0,0,0,0,1]},
 N:{factor:1,d:[1,1,-2,0,0,0,0]},J:{factor:1,d:[2,1,-2,0,0,0,0]},W:{factor:1,d:[2,1,-3,0,0,0,0]},
 Hz:{factor:1,d:[0,0,-1,0,0,0,0]},Pa:{factor:1,d:[-1,1,-2,0,0,0,0]},
 'm/s':{factor:1,d:[1,0,-1,0,0,0,0]},'km/h':{factor:1000/3600,d:[1,0,-1,0,0,0,0]},'m/s²':{factor:1,d:[1,0,-2,0,0,0,0]}
};
function unit(name){if(!Object.hasOwn(UNITS,name))throw Error('Unknown SI unit: '+name);return UNITS[name]}
function compatible(a,b){return a.every((v,i)=>v===b[i])}
function quantity(value,dimensions){if(!Number.isFinite(value))throw Error('Non-finite quantity');return Object.freeze({siValue:value,dimensions:Object.freeze([...dimensions])})}
export function fromUnit(value,name){if(!Number.isFinite(value))throw Error('Non-finite quantity');const u=unit(name);return quantity(value*u.factor,u.d)}
export function convertUnit(value,from,to){const a=unit(from),b=unit(to);if(!compatible(a.d,b.d))throw Error('Incompatible dimensions');if(!Number.isFinite(value))throw Error('Non-finite quantity');return value*a.factor/b.factor}
export function addQuantities(a,b){if(!compatible(a.dimensions,b.dimensions))throw Error('Cannot add incompatible dimensions');return quantity(a.siValue+b.siValue,a.dimensions)}
export function multiplyQuantities(a,b){return quantity(a.siValue*b.siValue,a.dimensions.map((v,i)=>v+b.dimensions[i]))}
export function divideQuantities(a,b){if(b.siValue===0)throw Error('Division by zero');return quantity(a.siValue/b.siValue,a.dimensions.map((v,i)=>v-b.dimensions[i]))}
export function describeDimensions(dimensions){if(!Array.isArray(dimensions)||dimensions.length!==7||dimensions.some(v=>!Number.isInteger(v)))throw Error('Invalid dimensions');return BASE.map((symbol,i)=>dimensions[i]===0?'':symbol+'^'+dimensions[i]).filter(Boolean).join(' ')||'dimensionless'}
