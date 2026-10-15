// Pure validation gates for scientific claims. No arbitrary expressions executed.
const allowed=new Set(['untested','reproduced','contradicted']);
export function assessScientificClaim({claim,referenceId,locator,observations=[],tolerance=1e-8}={}){
 if(typeof claim!=='string'||!claim.trim()||claim.length>1000)throw Error('Invalid scientific claim');
 if(typeof referenceId!=='string'||!referenceId.trim())throw Error('Missing source reference');
 if(typeof locator!=='string'||!locator.trim())throw Error('Missing source locator');
 if(!Number.isFinite(tolerance)||tolerance<0)throw Error('Invalid tolerance');
 if(!Array.isArray(observations)||observations.length>10000)throw Error('Invalid observations');
 const checked=observations.map(o=>{
  if(!o||!Number.isFinite(o.expected)||!Number.isFinite(o.actual))throw Error('Non-finite observation');
  const absoluteError=Math.abs(o.actual-o.expected);
  const scale=Math.max(1,Math.abs(o.expected));
  return {expected:o.expected,actual:o.actual,absoluteError,passes:absoluteError<=tolerance*scale};
 });
 const status=checked.length===0?'untested':checked.every(o=>o.passes)?'reproduced':'contradicted';
 if(!allowed.has(status))throw Error('Invalid claim status');
 return Object.freeze({claim,referenceId,locator,status,tolerance,observations:checked,scope:'numeric-check-only'});
}
