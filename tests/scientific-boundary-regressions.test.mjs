import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateResearchGraph} from '../src/math-graph-api.mjs';
import {convertUnit} from '../src/si-dimensions.mjs';
import {evaluateFormulaDocument} from '../src/math-formula-api.mjs';
test('legacy graph API rejects overflow rather than emitting null JSON results',()=>assert.throws(()=>evaluateResearchGraph({schema:'math.graph.execute.v1',mode:'HISTORICAL_RESEARCH',execution_authority:false,nodes:[{id:'a',kind:'source',values:[1e200,1e200]},{id:'b',kind:'source',values:[0,0]},{id:'d',kind:'transform',adapter:'series-difference',inputs:['a','b'],parameters:{}},{id:'e',kind:'transform',adapter:'comparison-energy',inputs:['d'],parameters:{}}]}),/FINITE/i));
test('SI conversion rejects arithmetic overflow',()=>assert.throws(()=>convertUnit(1e308,'km','m'),/finite/i));
test('formula v1 cannot echo caller-supplied scientific proof claims',()=>assert.throws(()=>evaluateFormulaDocument({schema:'math.formula.v1',execution_authority:false,values:[1,2],formula:'x',inputUnit:'dimensionless',outputUnit:'dimensionless',knowledge:{title:'Synthetic',sourceId:'untrusted',page:1,attested:false,status:'PROVEN'}})));
