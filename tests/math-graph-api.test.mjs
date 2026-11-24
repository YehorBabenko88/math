import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateResearchGraph} from '../src/math-graph-api.mjs';
const good=()=>({schema:'math.graph.execute.v1',mode:'HISTORICAL_RESEARCH',execution_authority:false,nodes:[
 {id:'a',kind:'source',values:[1,2,3]},{id:'b',kind:'source',values:[3,4,5]},
 {id:'difference',kind:'transform',adapter:'series-difference',inputs:['a','b'],parameters:{}},
 {id:'energy',kind:'transform',adapter:'comparison-energy',inputs:['difference'],parameters:{}}
]});
test('Math alone executes an aligned typed graph',()=>{
 const r=evaluateResearchGraph(good());
 assert.equal(r.schema,'math.graph.result.v1');assert.equal(r.output.type,'scalar');
 assert.equal(r.output.values,4);assert.equal(r.trace.length,4);
 assert.equal(r.trading_authorized,false);assert.equal(r.training_authorized,false);
});
test('rejects unknown adapters, live authority, malformed graphs',()=>{
 const p=good();p.execution_authority=true;assert.throws(()=>evaluateResearchGraph(p));
 const q=good();q.nodes[3].adapter='trade';assert.throws(()=>evaluateResearchGraph(q));
 const v=good();v.nodes[0].values=[1,Infinity];assert.throws(()=>evaluateResearchGraph(v));
 const w=good();w.nodes[3].inputs=['missing'];assert.throws(()=>evaluateResearchGraph(w));
});
