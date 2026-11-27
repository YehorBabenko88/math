import {types} from 'node:util';
import {convertUnit,unitConversionRatio} from './si-dimensions.mjs';

function dataObject(value,message){
 if(!value||typeof value!=='object'||types.isProxy(value))throw Error(message);
 const prototype=Object.getPrototypeOf(value);
 if(prototype!==Object.prototype&&prototype!==null)throw Error(message);
 return value;
}

function ownData(object,key,message){
 const descriptor=Object.getOwnPropertyDescriptor(object,key);
 if(descriptor&&Object.hasOwn(descriptor,'value'))return descriptor.value;
 if(descriptor)throw Error(message);
}

function readClaim(input){
 const spec=dataObject(input,'Invalid scientific claim');
 const claim=ownData(spec,'claim','Invalid scientific claim');
 const referenceId=ownData(spec,'referenceId','Missing source reference');
 const locator=ownData(spec,'locator','Missing source locator');
 const toleranceValue=ownData(spec,'tolerance','Invalid tolerance');
 const observationsValue=ownData(spec,'observations','Invalid observations');
 const tolerance=toleranceValue===undefined?1e-8:toleranceValue;
 const observations=observationsValue===undefined?[]:observationsValue;
 if(typeof claim!=='string'||!claim.trim()||claim.length>1000)throw Error('Invalid scientific claim');
 if(typeof referenceId!=='string'||!referenceId.trim())throw Error('Missing source reference');
 if(typeof locator!=='string'||!locator.trim())throw Error('Missing source locator');
 if(!Number.isFinite(tolerance)||tolerance<0)throw Error('Invalid tolerance');
 if(types.isProxy(observations)||!Array.isArray(observations))throw Error('Invalid observations');
 return {claim,referenceId,locator,tolerance,observations};
}

// Every finite binary64 is an integer multiple of 2^-1074.
function binary64Units(value,view){
 view.setFloat64(0,value,false);
 const bits=view.getBigUint64(0,false);
 const exponent=Number((bits>>52n)&0x7ffn);
 const fraction=bits&0xfffffffffffffn;
 const magnitude=exponent===0?fraction:((1n<<52n)|fraction)<<BigInt(exponent-1);
 return (bits>>63n)===0n?magnitude:-magnitude;
}

function compareObservations(input,dimensionChecked){
 const {claim,referenceId,locator,tolerance,observations}=readClaim(input);
 const observationCount=observations.length;
 if(observationCount>10000)throw Error('Invalid observations');
 const rowError=dimensionChecked?'Invalid observation':'Non-finite observation';
 const view=new DataView(new ArrayBuffer(8));
 const max=binary64Units(Number.MAX_VALUE,view);
 const maxProduct=max<<1074n;
 const toleranceUnits=binary64Units(tolerance,view);
 const checked=[];
 for(let index=0;index<observationCount;index++){
  const row=dataObject(ownData(observations,index,rowError),rowError);
  const expected=ownData(row,'expected','Non-finite observation');
  const actual=ownData(row,'actual','Non-finite observation');
  if(!Number.isFinite(expected)||!Number.isFinite(actual))throw Error('Non-finite observation');
  let numerator=1n,denominator=1n,normalizedActual=actual;
  if(dimensionChecked){
   const expectedUnit=ownData(row,'expectedUnit','Units required');
   const actualUnit=ownData(row,'actualUnit','Units required');
   if(typeof expectedUnit!=='string'||typeof actualUnit!=='string')throw Error('Units required');
   ({numerator,denominator}=unitConversionRatio(actualUnit,expectedUnit));
   if(actualUnit!==expectedUnit)normalizedActual=convertUnit(actual,actualUnit,expectedUnit);
  }
  const difference=binary64Units(actual,view)*numerator-binary64Units(expected,view)*denominator;
  const distance=difference<0n?-difference:difference;
  const threshold=toleranceUnits*binary64Units(Math.max(1,Math.abs(expected)),view);
  // Compare in the expected unit before binary64 conversion can round away a difference.
  const absoluteError=Math.abs(normalizedActual-expected);
  if(distance>max*denominator||threshold>maxProduct||!Number.isFinite(absoluteError))throw Error('NONFINITE_COMPARISON');
  checked.push(Object.freeze({
   expected,actual:normalizedActual,absoluteError,
   passes:(distance<<1074n)<=threshold*denominator
  }));
 }
 const status=checked.length===0?'untested':checked.every(o=>o.passes)?'reproduced':'contradicted';
 return {claim,referenceId,locator,status,tolerance,observations:Object.freeze(checked)};
}

export function assessScientificClaim(input={}){
 return Object.freeze({...compareObservations(input,false),scope:'numeric-check-only'});
}

// Validates the specific numerical examples of a sourced claim.
export function validateScientificExperiment(input={}){
 return Object.freeze({...compareObservations(input,true),dimensionChecked:true,unitPolicy:'explicit-si-compatible',scope:'dimension-and-numeric-examples-only'});
}
