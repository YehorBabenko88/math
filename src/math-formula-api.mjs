import {compileExpression} from './expression.mjs';
import {snapshotJSON} from './scientific-data.mjs';
// Controlled single-variable formula transform. No eval or external code.
const UNITS=new Set(['dimensionless','USD','USDT','BTC','seconds']);
export function evaluateFormulaDocument(d){
 d=snapshotJSON(d);
 if(!d||d.schema!=='math.formula.v1'||d.execution_authority!==false||
 !Array.isArray(d.values)||d.values.length<2||d.values.length>2000||
 d.values.some(x=>typeof x!=='number'||!Number.isFinite(x))||
 typeof d.formula!=='string'||d.formula.length>160||!UNITS.has(d.inputUnit)||
 !UNITS.has(d.outputUnit))throw Error('INVALID_FORMULA');
 // Nonlinear transformations must declare dimensionless input/output;
 // other units require an explicit conversion adapter, not implicit casting.
 if(d.inputUnit!=='dimensionless'||d.outputUnit!=='dimensionless')throw Error('UNIT_CONVERSION_NOT_AUTHORIZED');
 if(d.knowledge!==undefined){
  const k=d.knowledge;
  if(!k||Object.keys(k).sort().join(',')!=='attested,page,sourceId,title')throw Error('UNKNOWN_KNOWLEDGE_FIELDS');
  if(!k||typeof k.title!=='string'||!k.title.trim()||k.title.length>160||
    typeof k.sourceId!=='string'||!k.sourceId.trim()||k.sourceId.length>128||
    typeof k.page!=='number'||!Number.isSafeInteger(k.page)||k.page<1||
    k.attested!==false)throw Error('KNOWLEDGE_SOURCE_UNATTESTED');
 }
 const fn=compileExpression(d.formula);
 const values=d.values.map(x=>fn.evaluate(x));
 if(values.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('NONFINITE_FORMULA_RESULT');
 return {schema:'math.formula.result.v1',status:'RESEARCH_ONLY',values,
  inputUnit:d.inputUnit,outputUnit:d.outputUnit,knowledge:d.knowledge??null,
  source:'CALLER_SUPPLIED_UNATTESTED',trading_authorized:false,training_authorized:false,execution_authority:false};
}
