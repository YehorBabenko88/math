import test from 'node:test';
import assert from 'node:assert/strict';
import {assessScientificClaim} from '../src/scientific-claim-checks.mjs';
import {validateScientificExperiment} from '../src/scientific-experiment-validation.mjs';
import {validateGraphNodeEvidence} from '../src/graph-evidence-validation.mjs';
import {createExperimentEvidenceIndex,importExperimentEvidenceIndex} from '../src/experiment-evidence.mjs';

const source={claim:'Synthetic evidence',referenceId:'fixture',locator:'page 1',tolerance:0};
const matching={expected:1,actual:1,expectedUnit:'m',actualUnit:'m'};
const different={...matching,actual:2};
const graph={describe:()=>[{id:'fixture'}],execute:()=>({id:'fixture',type:'source',trace:[]})};
const routes=[assessScientificClaim,validateScientificExperiment,input=>validateGraphNodeEvidence(graph,'fixture',input).citationExamples];

test('scientific boundaries refuse proxied input without invoking traps',()=>{
 for(const validate of routes){
  let reads=0;
  const handler={get(target,key,receiver){reads++;return key==='length'?1:Reflect.get(target,key,receiver)}};
  for(const input of [
   new Proxy({...source,observations:[matching]},handler),
   {...source,observations:new Proxy([matching,different],handler)},
   {...source,observations:new Proxy(Array(10001).fill(matching),handler)},
   {...source,observations:[new Proxy(matching,handler)]},
  ])assert.throws(()=>validate(input));
  assert.equal(reads,0);
 }
});

test('scientific boundaries refuse accessors and inherited observation fields',()=>{
 for(const validate of routes){
  let reads=0;
  const observations=[matching];
  const proxyPrototype=new Proxy({}, {has(){reads++; return false}});
  const row={...matching,get actual(){reads++;return 1}};
  const getterIndex=Object.defineProperty([matching],0,{get(){reads++;return matching}});
  for(const input of [
   {...source,get observations(){reads++;return observations}},
   {...source,observations:getterIndex},
   {...source,observations:[row]},
   {...source,observations:[Object.create(matching)]},
   {...source,observations:[Object.create(proxyPrototype, {expected:{value:1}})]},
  ])assert.throws(()=>validate(input));
  assert.equal(reads,0);
 }
});

test('validated evidence remains consistent after it is returned',()=>{
 for(const validate of routes){
  const result=validate({...source,observations:[matching]});
  assert.throws(()=>{result.observations[0].passes=false},TypeError);
  assert.throws(()=>{result.observations.length=0},TypeError);
  assert.equal(result.status,'reproduced');
  assert.equal(result.observations.length,1);
 }
});

test('scientific boundaries preserve all supported dense observation counts',()=>{
 for(const validate of routes){
  for(const length of [0,1,9999,10000]){
   const result=validate({...source,observations:Array(length).fill(matching)});
   assert.equal(result.status,length?'reproduced':'untested');
   assert.equal(result.observations.length,length);
  }
  assert.throws(()=>validate({...source,observations:Array(10001).fill(matching)}));
 }
});

test('experiment comparison preserves equal values in the same units',()=>{
 for(const validate of routes.slice(1)){
  const observations=[{expected:0.9,actual:0.9,expectedUnit:'km/h',actualUnit:'km/h'}];
  assert.equal(validate({...source,observations}).status,'reproduced');
  const differentUnits=[{expected:10,actual:36,expectedUnit:'m/s',actualUnit:'km/h'}];
  assert.equal(validate({...source,observations:differentUnits}).status,'reproduced');
 }
});

test('experiment comparison does not equate a nonzero value to zero after underflow',()=>{
 for(const validate of routes.slice(1)){
  for(const expectedUnit of ['km/h','m/s']){
   const observations=[{expected:0,actual:Number.MIN_VALUE,expectedUnit,actualUnit:'km/h'}];
   assert.equal(validate({...source,observations}).status,'contradicted');
  }
 }
});

test('experiment evidence index refuses bare promoted statuses including imported JSON',()=>{
 for(const status of ['reproduced','contradicted']){
  const index=createExperimentEvidenceIndex();
  assert.throws(()=>index.attach('fixture',{bookId:'fixture'},{...source,status}));
  const links=[{nodeId:'fixture',...source,status}];
  assert.throws(()=>importExperimentEvidenceIndex(JSON.stringify({schemaVersion:1,links})));
 }
});
