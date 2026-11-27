// Pure validation gates for scientific claims. No arbitrary expressions executed.
const allowed=new Set(['untested','reproduced','contradicted']);
// Every finite binary64 is an integer multiple of 2^-1074.
function binary64Units(value,view){
 view.setFloat64(0,value,false);
 const bits=view.getBigUint64(0,false);
 const exponent=Number((bits>>52n)&0x7ffn);
 const fraction=bits&0xfffffffffffffn;
 const magnitude=exponent===0?fraction:((1n<<52n)|fraction)<<BigInt(exponent-1);
 return (bits>>63n)===0n?magnitude:-magnitude;
}
export function assessScientificClaim({claim,referenceId,locator,observations=[],tolerance=1e-8}={}){
 if(typeof claim!=='string'||!claim.trim()||claim.length>1000)throw Error('Invalid scientific claim');
 if(typeof referenceId!=='string'||!referenceId.trim())throw Error('Missing source reference');
 if(typeof locator!=='string'||!locator.trim())throw Error('Missing source locator');
 if(!Number.isFinite(tolerance)||tolerance<0)throw Error('Invalid tolerance');
 if(!Array.isArray(observations))throw Error('Invalid observations');
 const view=new DataView(new ArrayBuffer(8));
 const max=binary64Units(Number.MAX_VALUE,view);
 const maxProduct=max<<1074n;
 const toleranceUnits=binary64Units(tolerance,view);
 const observationCount=observations.length;
 if(!Number.isSafeInteger(observationCount)||observationCount<0||observationCount>10000)throw Error('Invalid observations');
 const checked=[];
 for(let index=0;index<observationCount;index++){
  if(!Object.hasOwn(observations,index))throw Error('Non-finite observation');
  const o=observations[index];
  if(!o)throw Error('Non-finite observation');
  const {expected,actual}=o;
  if(!Number.isFinite(expected)||!Number.isFinite(actual))throw Error('Non-finite observation');
  const difference=binary64Units(actual,view)-binary64Units(expected,view);
  const distance=difference<0n?-difference:difference;
  const threshold=toleranceUnits*binary64Units(Math.max(1,Math.abs(expected)),view);
  // Distance uses units 2^-1074; threshold uses units 2^-2148.
  // Reject exact out-of-range values even when rounding would return MAX.
  if(distance>max||threshold>maxProduct)throw Error('NONFINITE_COMPARISON');
  checked.push({expected,actual,absoluteError:Math.abs(actual-expected),passes:(distance<<1074n)<=threshold});
 }
 const status=checked.length===0?'untested':checked.every(o=>o.passes)?'reproduced':'contradicted';
 if(!allowed.has(status))throw Error('Invalid claim status');
 return Object.freeze({claim,referenceId,locator,status,tolerance,observations:checked,scope:'numeric-check-only'});
}
