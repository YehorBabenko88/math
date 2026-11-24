import {snapshotJSON,exact} from './scientific-data.mjs';
import {unitSpec} from './scientific-units.mjs';
export const UNIT_SYNTAX=Object.freeze({schema:'math.unit-expression.v1',maxLength:96,maxFactors:8,maxAbsExponent:8,maxAbsDimension:16,operators:Object.freeze(['*','/','^']),parentheses:false});
export function evaluateUnitRequest(input){
 const d=snapshotJSON(input);exact(d,['schema','execution_authority','units']);
 if(d.schema!=='math.units.describe.v1'||d.execution_authority!==false||!Array.isArray(d.units)||d.units.length<1||d.units.length>16||new Set(d.units).size!==d.units.length)throw Error('INVALID_UNITS_REQUEST');
 return {schema:'math.units.result.v1',units:d.units.map(unit=>{const spec=unitSpec(unit);return {unit,factor:spec.factor,dimensions:spec.dimensions};}),execution_authority:false,trading_authorized:false};
}
