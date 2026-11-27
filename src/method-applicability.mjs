import {encodeMetadata,decodeMetadata,decodeBinary64Hex} from './math-universe-codec.mjs';
const fail=()=>{throw new Error('INVALID_SCHEMA');};
// Versioned structural rules only; no method scores or execution authority.
export function assessStructuralApplicability(input){
  let x;try{x=decodeMetadata(encodeMetadata(input));}catch{fail();}
  const keys=['schema','sampleIds','eventMs','rowsBits','cadenceMs'];
  if(!x||typeof x!=='object'||Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k))||x.schema!=='math.method.structural.request.v1')fail();
  const {sampleIds,eventMs,rowsBits,cadenceMs}=x;
  if(!Array.isArray(rowsBits)||rowsBits.length<2||rowsBits.length>256||!Array.isArray(sampleIds)||!Array.isArray(eventMs)||sampleIds.length!==rowsBits.length||eventMs.length!==rowsBits.length||!Number.isSafeInteger(cadenceMs)||cadenceMs<=0)fail();
  const n=rowsBits.length,d=Array.isArray(rowsBits[0])?rowsBits[0].length:0;
  if(d!==4&&d!==32)fail();
  const seen=new Set(),zeroRowIds=[],constant=Array(d).fill(true);let gapCount=0;
  for(let i=0;i<n;i++){
    const id=sampleIds[i],time=eventMs[i],row=rowsBits[i];
    if(typeof id!=='string'||!/^[\x21-\x7e]{1,128}$/.test(id)||seen.has(id)||!Number.isSafeInteger(time)||time<0||(i>0&&time<=eventMs[i-1])||!Array.isArray(row)||row.length!==d)fail();
    seen.add(id);if(i>0&&(time-eventMs[i-1])!==cadenceMs)gapCount++;
    let zero=true;
    for(let j=0;j<d;j++){
      try{decodeBinary64Hex(row[j]);}catch{fail();}
      if(row[j]!=='0000000000000000')zero=false;
      if(i>0&&row[j]!==rowsBits[0][j])constant[j]=false;
    }
    if(zero)zeroRowIds.push(id);
  }
  const constantColumns=constant.flatMap((v,i)=>v?[i]:[]),regular=gapCount===0;
  const domains=[];
  const add=(domain,status,...reasons)=>domains.push({domain,status,reasons});
  add('EUCLIDEAN','CANDIDATE');
  zeroRowIds.length?add('SPHERICAL','REFUSED','ZERO_DIRECTION'):add('SPHERICAL','CANDIDATE');
  constantColumns.length?add('STATISTICS','PENDING_PREREQUISITE','CONSTANT_COLUMNS','ESTIMATOR_REQUIRED'):add('STATISTICS','CANDIDATE');
  !regular?add('DYNAMICS','REFUSED','IRREGULAR_CADENCE'):n<3?add('DYNAMICS','PENDING_PREREQUISITE','INSUFFICIENT_SAMPLE_SUPPORT'):add('DYNAMICS','CANDIDATE');
  add('GRAPH','PENDING_PREREQUISITE','GRAPH_REQUIRED');
  add('TOPOLOGY','PENDING_PREREQUISITE','METRIC_REQUIRED');
  add('MANIFOLD','PENDING_PREREQUISITE','MANIFOLD_ASSUMPTIONS_REQUIRED');
  add('DISTRIBUTION','PENDING_PREREQUISITE','ESTIMATOR_REQUIRED');
  return {schema:'math.method.structural.result.v1',facts:{dimension:d,sampleCount:n,regular,gapCount,zeroRowIds,constantColumns},domains,executionAuthority:false,tradingAuthorized:false};
}
