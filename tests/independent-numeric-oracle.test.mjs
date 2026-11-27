import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assessScientificClaim} from '../src/scientific-claim-checks.mjs';
import {evaluateFormulaDocument} from '../src/math-formula-api.mjs';

const bits = n => { const b = Buffer.alloc(8); b.writeDoubleBE(n); return b.toString('hex'); };
const number = s => Buffer.from(s, 'hex').readDoubleBE();
const max = Number.MAX_VALUE, min = Number.MIN_VALUE;
const vectors = [
 ['overflow-both',1.2e308,-1.7e308,2,'REJECT_RANGE'],
 ['rounded-threshold',10,13,.3,'FAIL'],
 ['rounded-difference',1,-(2**-54),1,'FAIL'],
 ['inclusive',8,10,.25,'PASS'],
 ['nextafter',8,number('4024000000000001'),.25,'FAIL'],
 ['subnormal-fail',0,min,0,'FAIL'],
 ['subnormal-pass',0,min,min,'PASS'],
 ['max-equal',max,max,0,'PASS'],
 ['threshold-overflow',max,max,2,'REJECT_RANGE'],
 ['error-overflow',max,-max,0,'REJECT_RANGE'],
 ['rounds-to-max',max,-min,1,'REJECT_RANGE'],
 ['nan',NaN,1,0,'REJECT_INPUT'],
 ['infinity',1,Infinity,0,'REJECT_INPUT'],
 ['negative-infinity',-Infinity,1,0,'REJECT_INPUT'],
 ['infinite-tolerance',1,1,Infinity,'REJECT_INPUT'],
 ['negative-tolerance',1,1,-1,'REJECT_INPUT'],
 ['ordinary-pass',5,5,0,'PASS'],
 ['ordinary-fail',5,6,0,'FAIL'],
 ['signed-zero',-0,0,-0,'PASS'],
];
const base = {claim:'Independent P1 numeric fixture',referenceId:'synthetic',locator:'P1'};
test('independent rational oracle and candidate agree with frozen analytic outcomes', () => {
 const rows = vectors.map(([id,e,a,t])=>({id,expected:bits(e),actual:bits(a),tolerance:bits(t)}));
 const python = process.env.P1_ORACLE_PYTHON;
 assert.ok(python, 'P1_ORACLE_PYTHON must name the trusted interpreter');
 const run = spawnSync(python,[fileURLToPath(new URL('./independent-numeric-oracle.py',import.meta.url))],
   {input:JSON.stringify(rows),encoding:'utf8',timeout:10000,maxBuffer:65536,shell:false});
 assert.ifError(run.error);
 assert.equal(run.status,0,run.stderr);
 const results=JSON.parse(run.stdout);
 assert.equal(results.length,vectors.length);
 for (let i=0;i<vectors.length;i++) {
   const [id,e,a,t,want]=vectors[i], oracle=results[i];
   assert.equal(oracle.id,id);
   assert.equal(oracle.outcome,want,id);
   const invoke=()=>assessScientificClaim({...base,tolerance:t,observations:[{expected:e,actual:a}]});
   if(want==='REJECT_RANGE') { assert.throws(invoke,{message:'NONFINITE_COMPARISON'},id); continue; }
   if(want==='REJECT_INPUT') { assert.throws(invoke,undefined,id); continue; }
   const result=invoke();
   assert.equal(result.status,want==='PASS'?'reproduced':'contradicted',id);
   assert.equal(result.scope,'numeric-check-only');
   assert.equal(result.observations.length,1);
   const obs=result.observations[0];
   assert.equal(obs.passes,want==='PASS',id);
   assert.equal(bits(obs.absoluteError),oracle.diagnostic,id);
   assert.ok(Number.isFinite(obs.absoluteError),id);
 }
});
test('legacy empty, default and mixed observations',()=>{
 assert.equal(assessScientificClaim(base).status,'untested');
 const r=assessScientificClaim({...base,observations:[{expected:5,actual:5},{expected:5,actual:6}]});
 assert.equal(r.tolerance,1e-8);
 assert.equal(r.status,'contradicted');
});
const formula=(formula,values)=>evaluateFormulaDocument({schema:'math.formula.v1',execution_authority:false,formula,values,inputUnit:'dimensionless',outputUnit:'dimensionless'});
test('formula rejects hidden nonfinite intermediates and whole mixed batch',()=>{
 for(const f of ['exp(1000*x)^0','1/exp(1000*x)','1e309^0','sqrt(-1)^0'])
   assert.throws(()=>formula(f,[1,2]),{message:'NONFINITE_FORMULA_RESULT'},f);
 assert.throws(()=>formula('(1/x)^0',[0,1]),{message:'NONFINITE_FORMULA_RESULT'});
 assert.throws(()=>formula('exp(1000*x)^0',[0,1]),{message:'NONFINITE_FORMULA_RESULT'});
});
test('finite formula parity and authority remain unchanged',()=>{
 const r=formula('x^2',[2,3]);
 assert.deepEqual(r.values,[4,9]);
 assert.equal(r.schema,'math.formula.result.v1');
 assert.equal(r.status,'RESEARCH_ONLY');
 for(const k of ['execution_authority','trading_authorized','training_authorized']) assert.equal(r[k],false);
 assert.deepEqual(formula('-x^2',[2,3]).values,[-4,-9]);
 assert.deepEqual(formula('2^-2^3',[2,3]).values,[1/256,1/256]);
});
