// Strict Grid provenance v1.1 to Math feature input boundary.
// No attestation, derivation or synthetic substitution. Never returns trading authority.
export function inspectGridFeatureHandoff(handoff, featureRows, trustedReceipt=false) {
 const blocked=(reason)=>({status:'BLOCKED',reason,rows:[],provenance:'NOT_VERIFIED',trading:'DISABLED',admission:'BLOCKED'});
 if(!handoff||typeof handoff!=='object'||handoff.api_version?.major!==1||handoff.api_version?.minor!==1||
    handoff.producer!=='strattester'||handoff.mode!=='HISTORICAL'||handoff.execution_authority!==false)
  return blocked('INVALID_HANDOFF');
 if(!trustedReceipt) return blocked('SOURCE_PROVENANCE_UNATTESTED');
 // A caller assertion alone is not attestation: this boolean is permitted only for
 // independently verified evidence; the function does not establish trust itself.
 if(handoff.dataset?.coverage!=='COMPLETE'||!Array.isArray(handoff.dataset?.missing_data)||
    handoff.dataset.missing_data.length!==0)
  return blocked('INCOMPLETE_DATASET');
 if(!Array.isArray(featureRows)||featureRows.length<2)return blocked('FEATURE_ROWS_MISSING');
 const names=['volume','imbalance','openInterestChange','volatility'];
 const output=[];
 for(let i=0;i<featureRows.length;i++){
  const r=featureRows[i];
  if(!r||!Number.isSafeInteger(r.closeTime)||!Number.isSafeInteger(r.availableAt)||
     !Number.isFinite(r.close)||r.close<=0||r.availableAt>r.closeTime||
     (i>0&&(r.closeTime<=featureRows[i-1].closeTime||r.availableAt<=featureRows[i-1].closeTime)))
   return blocked('TIME_CAUSALITY_UNVERIFIED');
  if(!r.features||names.some(n=>typeof r.features[n]!=='number'||!Number.isFinite(r.features[n])))
   return blocked('FEATURES_UNAVAILABLE');
  output.push({closeTime:r.closeTime,availableAt:r.availableAt,close:r.close,
   features:Object.fromEntries(names.map(n=>[n,r.features[n]]))});
 }
 return {status:'SCHEMA_COMPATIBLE_NOT_ATTESTED',reason:'EXTERNAL_PROVENANCE_REQUIRED',
  rows:output,provenance:'NOT_VERIFIED',trading:'DISABLED',admission:'BLOCKED'};
}
