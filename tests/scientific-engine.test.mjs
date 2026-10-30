import test from 'node:test';
import assert from 'node:assert/strict';
import {executeScientificGraph, createScientificCatalog, scientificCapabilities} from '../src/scientific-engine.mjs';
const hash='a'.repeat(64);
const source=(id,unit='m',values=[1,2,3])=>({id,kind:'source',type:'series',unit,values,timestamps:[1,2,3],availableAt:[1,2,3],provenance:{sourceId:'synthetic',version:'v1',sha256:hash}});
const edge=(from,to,input='x')=>({from:{node:from,port:'value'},to:{node:to,port:input}});
const graph=(nodes,edges,output=nodes.at(-1).id)=>({schema:'math.scientific.graph.v2',mode:'HISTORICAL_RESEARCH',execution_authority:false,asOf:3,nodes,edges,outputs:[{node:output,port:'value'}]});
test('named DAG is deterministic and applies AST with dimensions and explicit conversions',()=>{
 const d=graph([source('s','km'),{id:'c',kind:'convert',unit:'m'},{id:'f',kind:'formula',expression:'x*2',outputUnit:'m'}],[edge('s','c'),edge('c','f')]);
 const a=executeScientificGraph(d);assert.deepEqual(a.outputs[0].values,[2000,4000,6000]);
 assert.deepEqual(a,executeScientificGraph({...d,nodes:[...d.nodes].reverse(),edges:[...d.edges].reverse()}));
 assert.deepEqual(a.order,['s','c','f']);assert.equal(a.execution_authority,false);assert.equal(a.mathematicallyVerified,false);
 assert.equal(a.trace[2].dependencies[0].node,'c');assert.equal(a.trace[0].provenance.sourceId,'synthetic');
});
test('units, physical dimensions, temporal alignment and nonfinite operations reject',()=>{
 for(const expression of ['x+1','sin(x)','x+x^2'])assert.throws(()=>executeScientificGraph(graph([source('s'),{id:'f',kind:'formula',expression,outputUnit:'m'}],[edge('s','f')])));
 for(const unit of ['s','USD'])assert.throws(()=>executeScientificGraph(graph([source('s'),{id:'c',kind:'convert',unit}],[edge('s','c')])));
 assert.throws(()=>executeScientificGraph(graph([source('s','dimensionless',[1,2,3]),{id:'f',kind:'formula',expression:'1/(x-2)',outputUnit:'dimensionless'}],[edge('s','f')])));
 const bad=source('s');bad.availableAt[1]=3;assert.throws(()=>executeScientificGraph(graph([bad],[])));
 const unordered=source('s');unordered.timestamps=[1,1,3];assert.throws(()=>executeScientificGraph(graph([unordered],[])));
 const future=graph([source('s')],[]);future.asOf=2;assert.throws(()=>executeScientificGraph(future));
});
test('multiple sinks, scalar ports, cycle and unknown port checks',()=>{
 const d=graph([source('s'),{id:'f',kind:'formula',expression:'x*2',outputUnit:'m'},{id:'g',kind:'formula',expression:'x*3',outputUnit:'m'}],[edge('s','f'),edge('s','g')]);d.outputs=[{node:'f',port:'value'},{node:'g',port:'value'}];assert.equal(executeScientificGraph(d).outputs.length,2);
 const cycle=graph([{id:'a',kind:'convert',unit:'m'},{id:'b',kind:'convert',unit:'m'}],[edge('a','b'),edge('b','a')]);assert.throws(()=>executeScientificGraph(cycle),/CYCLE/);
 const unknown=structuredClone(d);unknown.edges[0].from.port='missing';assert.throws(()=>executeScientificGraph(unknown));
 const many=[source('s')],edges=[];for(let i=0;i<50;i++){many.push({id:'n'+i,kind:'formula',expression:'x',outputUnit:'m'});edges.push(edge(i?'n'+(i-1):'s','n'+i));}assert.equal(executeScientificGraph(graph(many,edges)).order.length,51);
});
test('book formula binds extraction bytes/version/page and never proves a hypothesis',()=>{
 const record={id:'book-formula',sourceId:'book',source:{sourceHash:hash,edition:'edition1',page:7,extractionVersion:'ocr1',text:'Synthetic relation y=2x'},status:'SOURCE_REVIEWED',expression:'x*2',inputUnit:'m',outputUnit:'m',hypothesis:'Scale relation in stated assumptions',confidence:'NOT_VERIFIED'};
 const catalog=createScientificCatalog([record]);const ref=catalog.describe()[0];
 assert.equal(Object.hasOwn(ref.source,'text'),false);
 const d=graph([source('s'),{id:'f',kind:'knowledge',reference:{id:ref.id,sha256:ref.sha256}}],[edge('s','f')]);
 const result=executeScientificGraph(d,{catalog});assert.deepEqual(result.outputs[0].values,[2,4,6]);assert.equal(result.trace[1].knowledge.source.page,7);assert.equal(result.mathematicallyVerified,false);
 assert.equal(Object.hasOwn(result.trace[1].knowledge.source,'text'),false);
 const changed=structuredClone(record);changed.expression='x*3';assert.throws(()=>executeScientificGraph(d,{catalog:createScientificCatalog([changed])}),/SOURCE/);
 assert.throws(()=>createScientificCatalog([{...record,status:'KERNEL_VERIFIED'}]));
 assert.throws(()=>executeScientificGraph(d));
});
test('causal lag and prefix reproducibility do not use future labels',()=>{
 const d=graph([source('s'),{id:'l',kind:'lag',steps:1}],[edge('s','l')]);
 const a=executeScientificGraph(d);assert.deepEqual(a.outputs[0].values,[1,2]);assert.deepEqual(a.outputs[0].timestamps,[2,3]);
 const changed=structuredClone(d);changed.nodes[0].values[2]=999;assert.deepEqual(a.outputs,executeScientificGraph(changed).outputs);
});
test('hidden intermediate Infinity is not accepted as a finite result',()=>{
 assert.throws(()=>executeScientificGraph(graph([source('s','dimensionless'),{id:'f',kind:'formula',expression:'1/exp(1000)',outputUnit:'dimensionless'}],[edge('s','f')])));
});
test('scalar types, physical multiplication/division and no implicit currency conversion',()=>{
 const scalar=(id,unit,value)=>({id,kind:'source',type:'scalar',unit,value,timestamp:1,availableAt:1,provenance:{sourceId:'synthetic',version:'v1',sha256:hash}});
 const d=graph([scalar('a','N',2),scalar('b','m',3),{id:'f',kind:'multiply',outputUnit:'J'}],[edge('a','f','a'),edge('b','f','b')]);
 assert.deepEqual(executeScientificGraph(d).outputs[0].values,[6]);
 for(const units of [['USD','USDT'],['BTC','USD']])assert.throws(()=>executeScientificGraph(graph([source('s',units[0]),{id:'c',kind:'convert',unit:units[1]}],[edge('s','c')])));
 const denied=graph([source('s'),{id:'f',kind:'formula',expression:'process.exit(0)',outputUnit:'m'}],[edge('s','f')]);assert.throws(()=>executeScientificGraph(denied));
});
test('capability snapshots cannot mutate execution port ordering',()=>{
 const d=graph([source('a','m',[10,10,10]),source('b','m',[3,3,3]),{id:'f',kind:'difference'}],[edge('a','f','a'),edge('b','f','b')]);
 const before=executeScientificGraph(d);const cap=scientificCapabilities();cap.ports.difference.inputs.reverse();
 try{assert.deepEqual(executeScientificGraph(d),before);}finally{cap.ports.difference.inputs.reverse();}
});
test('duplicate/missing ports, scalar-series mismatch and misaligned timestamps block',()=>{
 const d=graph([source('a'),source('b'),{id:'f',kind:'difference'}],[edge('a','f','a'),edge('b','f','b')]);
 const duplicate=structuredClone(d);duplicate.edges.push(edge('a','f','a'));assert.throws(()=>executeScientificGraph(duplicate));
 const missing=structuredClone(d);missing.edges.pop();assert.throws(()=>executeScientificGraph(missing));
 const axis=structuredClone(d);axis.nodes[1].timestamps=[0,2,3];axis.nodes[1].availableAt=[0,2,3];assert.throws(()=>executeScientificGraph(axis),/MISALIGNED/);
 const mixed=structuredClone(d);mixed.nodes[1]={id:'b',kind:'source',type:'scalar',unit:'m',value:1,timestamp:1,availableAt:1,provenance:source('z').provenance};assert.throws(()=>executeScientificGraph(mixed),/MISALIGNED/);
});
test('resource limits are enforced and JSON boundary never invokes getters/proxies',()=>{
 const oversized=graph(Array.from({length:129},(_,i)=>source('s'+i)),[],'s0');assert.throws(()=>executeScientificGraph(oversized),/LIMIT/);
 const many=graph([source('s')],[]);many.edges=Array(257).fill(edge('s','s'));assert.throws(()=>executeScientificGraph(many),/LIMIT/);
 const big=source('s');big.values=Array(2049).fill(1);big.timestamps=Array.from({length:2049},(_,i)=>i);big.availableAt=[...big.timestamps];assert.throws(()=>executeScientificGraph(graph([big],[])));
 const expensive=Array.from({length:9},(_,i)=>({...source('s'+i),values:Array(2048).fill(1),timestamps:Array.from({length:2048},(_,j)=>j),availableAt:Array.from({length:2048},(_,j)=>j)}));const e=graph(expensive,[],'s0');e.asOf=2048;assert.throws(()=>executeScientificGraph(e),/LIMIT/);
 let calls=0;const getter={get schema(){calls++;throw Error('must not run');}};assert.throws(()=>executeScientificGraph(getter));assert.equal(calls,0);
 const proxy=new Proxy({}, {ownKeys(){calls++;throw Error('must not run');}});assert.throws(()=>executeScientificGraph(proxy));assert.equal(calls,0);
 const sparse=graph([source('s')],[]);delete sparse.nodes[0].values[1];assert.throws(()=>executeScientificGraph(sparse),/DENSE/);
 assert.throws(()=>executeScientificGraph({...graph([source('s')],[]),extra:'x'.repeat(262145)}),/LIMIT/);
 const heavy={...source('s','dimensionless'),values:Array(2048).fill(1),timestamps:Array.from({length:2048},(_,i)=>i),availableAt:Array.from({length:2048},(_,i)=>i)};
 const heavyNodes=[heavy],heavyEdges=[];for(let i=0;i<4;i++){heavyNodes.push({id:'n'+i,kind:'formula',expression:Array(79).fill('x').join('+'),outputUnit:'dimensionless'});heavyEdges.push(edge(i?'n'+(i-1):'s','n'+i));}const budget=graph(heavyNodes,heavyEdges);budget.asOf=2048;assert.throws(()=>executeScientificGraph(budget),/COMPUTATION_LIMIT/);
});
test('scientific source edition/page mutation invalidates the pinned reference',()=>{
 const r={id:'book',sourceId:'source',source:{sourceHash:hash,edition:'one',page:2,extractionVersion:'v1',text:'Synthetic'},status:'SOURCE_REVIEWED',expression:'x',inputUnit:'m',outputUnit:'m',hypothesis:'Synthetic only',confidence:'NOT_VERIFIED'};
 const pin=createScientificCatalog([r]).describe()[0];const d=graph([source('s'),{id:'f',kind:'knowledge',reference:{id:pin.id,sha256:pin.sha256}}],[edge('s','f')]);
 for(const source of [{...r.source,page:3},{...r.source,edition:'two'},{...r.source,sourceHash:'b'.repeat(64)}])assert.throws(()=>executeScientificGraph(d,{catalog:createScientificCatalog([{...r,source}])}),/SOURCE_BINDING/);
 assert.throws(()=>executeScientificGraph(d,{catalog:{describe:()=>[]}}),/UNTRUSTED/);
});
test('output summaries are computed centrally and retain units without predictive claims',()=>{
 const r=executeScientificGraph(graph([source('s','m',[1,2,6])],[]));
 assert.deepEqual(r.metrics.outputs,[{node:'s',port:'value',unit:'m',count:3,min:1,max:6,mean:3}]);
 assert.equal(r.metrics.kind,'DESCRIPTIVE_OUTPUT_SUMMARIES');
});
