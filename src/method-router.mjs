// Local pure slice: accepts only inert metadata from protected upstream decoder.
// Descriptive selection, not an authorization or independent receipt verifier.
const flags = {assumptionsMet:'ASSUMPTIONS',coverageMet:'COVERAGE',causalSampleMet:'CAUSAL_SAMPLE',qualityMet:'QUALITY',validationMet:'VALIDATION',resourceMet:'RESOURCE'};
const domains = new Set(['EUCLIDEAN','SPHERICAL','STATISTICS','DYNAMICS','GRAPH','TOPOLOGY','MANIFOLD','DISTRIBUTION']);
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const fail=()=>{throw new TypeError('INVALID_SCHEMA');};
function closed(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))fail();}
function ref(r){if(typeof r!=='string'||!/^[0-9a-f]{64}$/.test(r))fail();return r;}
function refs(a,max){if(!Array.isArray(a)||a.length>max)fail();const s=new Set();for(const r of a){ref(r);if(s.has(r))fail();s.add(r);}return s;}
// Shape-only binary64 reading; no metadata codec or digest implementation.
function number(h){if(typeof h!=='string'||!/^[0-9a-f]{16}$/.test(h)||h==='8000000000000000')fail();const v=Buffer.from(h,'hex').readDoubleBE();if(!Number.isFinite(v))fail();return v;}
export function selectMethods(request){
  closed(request,['schema','developmentRef','policyRef','portStateRefs','candidates']);
  if(request.schema!=='math.method.request.v1')fail();
  const developmentRef=ref(request.developmentRef),policyRef=ref(request.policyRef),ports=refs(request.portStateRefs,256);
  if(!Array.isArray(request.candidates)||request.candidates.length>128)fail();
  const seen=new Set(), decisions=[], ranked=[];
  for(const c of request.candidates){
    closed(c,['methodRef','domain','requiredPortStateRefs',...Object.keys(flags),'developmentScoreBits','uncertaintyBits','costOps']);
    const methodRef=ref(c.methodRef);if(seen.has(methodRef)||!domains.has(c.domain))fail();seen.add(methodRef);
    const reasons=[];
    for(const [key,code] of Object.entries(flags)){if(typeof c[key]!=='boolean')fail();if(!c[key])reasons.push(code);}
    const required=refs(c.requiredPortStateRefs,256);if([...required].some(r=>!ports.has(r)))reasons.push('PORT_MISMATCH');
    if(!Number.isSafeInteger(c.costOps)||c.costOps<0)fail();
    const score=c.developmentScoreBits===null?null:number(c.developmentScoreBits);
    const uncertainty=c.uncertaintyBits===null?null:number(c.uncertaintyBits);
    if(uncertainty!==null&&uncertainty<0)fail();
    if(score===null||uncertainty===null)reasons.push('NO_DEVELOPMENT_EVIDENCE');
    decisions.push({methodRef,status:reasons.length?'REJECTED':'ELIGIBLE',reasons});
    if(!reasons.length)ranked.push({methodRef,score,uncertainty,cost:c.costOps});
  }
  ranked.sort((a,b)=>cmp(b.score,a.score)||cmp(a.uncertainty,b.uncertainty)||cmp(a.cost,b.cost)||cmp(a.methodRef,b.methodRef));
  decisions.sort((a,b)=>cmp(a.methodRef,b.methodRef));
  return {schema:'math.method.decision.v1',status:ranked.length?'SELECTED':'ABSTAIN',selected:ranked.map(x=>x.methodRef),decisions,developmentRef,policyRef};
}
