import {assessScientificClaim} from './scientific-claim-checks.mjs';
import {fromUnit,convertUnit} from './si-dimensions.mjs';
// Validates the *specific numerical examples* of a sourced claim, not a theorem.
export function validateScientificExperiment({claim,referenceId,locator,observations=[],tolerance=1e-8}={}){
 if(!Array.isArray(observations))throw Error('Invalid observations');
 const normalized=observations.map(observation=>{
  if(!observation||typeof observation!=='object')throw Error('Invalid observation');
  const {expected,actual,expectedUnit,actualUnit}=observation;
  if(!Number.isFinite(expected)||!Number.isFinite(actual))throw Error('Non-finite observation');
  if(typeof expectedUnit!=='string'||typeof actualUnit!=='string')throw Error('Units required');
  const expectedSI=fromUnit(expected,expectedUnit);
  const actualSI=fromUnit(actual,actualUnit);
  // Conversion verifies dimensional compatibility and yields the expected-unit value.
  const normalizedActual=convertUnit(actual,actualUnit,expectedUnit);
  if(!expectedSI.dimensions.every((v,i)=>v===actualSI.dimensions[i]))throw Error('Incompatible observation dimensions');
  return {expected,actual:normalizedActual};
 });
 const result=assessScientificClaim({claim,referenceId,locator,observations:normalized,tolerance});
 return Object.freeze({...result,dimensionChecked:true,unitPolicy:'explicit-si-compatible',scope:'dimension-and-numeric-examples-only'});
}
