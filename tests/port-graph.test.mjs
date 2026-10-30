import test from 'node:test';
import assert from 'node:assert/strict';
import {compilePortGraph} from '../src/port-graph.mjs';
import {evaluateResearchGraph} from '../src/math-graph-api.mjs';
const graph=()=>({schema:'math.port-graph.v1',execution_authority:false,nodes:[
{id:'energy',kind:'energy'},{id:'a',kind:'source',values:[1,2,3]},{id:'diff',kind:'difference'},{id:'b',kind:'source',values:[3,4,5]}],
edges:[{from:'a',to:'diff',port:0},{from:'b',to:'diff',port:1},{from:'diff',to:'energy',port:0}]});
test('arbitrary node order compiles to executable typed Math graph',()=>{
const compiled=compilePortGraph(graph());assert.equal(compiled.nodes.at(-1).id,'energy');
const result=evaluateResearchGraph(compiled);assert.equal(result.output.values,4);assert.equal(result.trading_authorized,false);
});
test('invalid ports, cycles and disconnected nodes fail closed',()=>{
const duplicate=graph();duplicate.edges.push({from:'a',to:'diff',port:0});assert.throws(()=>compilePortGraph(duplicate));
const mismatch=graph();mismatch.edges[2]={from:'a',to:'energy',port:0};assert.throws(()=>compilePortGraph(mismatch));
const disconnected=graph();disconnected.nodes.push({id:'unused',kind:'source',values:[1,2]});assert.throws(()=>compilePortGraph(disconnected));
const authority=graph();authority.execution_authority=true;assert.throws(()=>compilePortGraph(authority));
});
