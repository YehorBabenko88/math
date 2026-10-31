import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {executeScientificGraph,scientificCapabilities,createScientificCatalog} from '../src/scientific-engine.mjs';
import {unitSpec} from '../src/scientific-units.mjs';
import {evaluateUnitRequest} from '../src/scientific-unit-api.mjs';
const hash='a'.repeat(64);
const source=(id,unit,values,timestamps=values.map((_,i)=>i*1000))=>({id,kind:'source',type:'series',unit,values,timestamps,availableAt:[...timestamps],provenance:{sourceId:'synthetic',version:'v1',sha256:hash}});
const edge=(from,to,input='x',output='value')=>({from:{node:from,port:output},to:{node:to,port:input}});
const graph=(nodes,edges,outputs=[{node:nodes.at(-1).id,port:'value'}])=>({schema:'math.scientific.graph.v2',mode:'HISTORICAL_RESEARCH',execution_authority:false,asOf:100000,nodes,edges,outputs});
test('known two-formula chain reproduces [5,17,37] without a physical claim',()=>{
 const d=JSON.parse(readFileSync(new URL('../examples/scientific-graph.v2.json',import.meta.url)));
 assert.deepEqual(executeScientificGraph(d).outputs[1].values,[5,17,37]);
});
test('compound units infer squared dimensions and explicitly convert area',()=>{
 const d=graph([source('s','km',[1,2]),{id:'square',kind:'formula',expression:'x^2',outputUnit:'m^2'},{id:'cm',kind:'convert',unit:'cm^2'}],[edge('s','square'),edge('square','cm')]);
 assert.deepEqual(executeScientificGraph(d).outputs[0].values,[1e10,4e10]);
 assert.deepEqual(unitSpec('kg*m^2/s^2').dimensions,unitSpec('J').dimensions);
 assert.equal(unitSpec('USD/BTC').dimensions[7],1);assert.equal(unitSpec('USD/BTC').dimensions[9],-1);
 for(const unit of ['m//s','m^999','m^2^3','m/(s)','m * s','__proto__','m^NaN'])assert.throws(()=>unitSpec(unit));
});
test('backward derivative and prefix trapezoid integral use UTC milliseconds and physical units',()=>{
 const d=graph([source('s','m',[0,2,4,6]),{id:'rate',kind:'derivative',outputUnit:'m/s'},{id:'area',kind:'integral',outputUnit:'m*s'}],[edge('s','rate'),edge('s','area')],[{node:'rate',port:'value'},{node:'area',port:'value'}]);
 const r=executeScientificGraph(d);assert.deepEqual(r.outputs[0].values,[2,2,2]);assert.deepEqual(r.outputs[0].timestamps,[1000,2000,3000]);assert.deepEqual(r.outputs[1].values,[0,1,4,9]);
 const bad=structuredClone(d);bad.nodes[1].outputUnit='m';assert.throws(()=>executeScientificGraph(bad));
});
test('rolling mean is trailing, fixed-window and insensitive to a future suffix',()=>{
 const d=graph([source('s','m',[1,3,5,7]),{id:'mean',kind:'rolling-mean',window:2}],[edge('s','mean')]);
 const a=executeScientificGraph(d).outputs[0];assert.deepEqual(a.values,[2,4,6]);assert.deepEqual(a.timestamps,[1000,2000,3000]);
 const b=structuredClone(d);b.nodes[0].values[3]=700;assert.deepEqual(executeScientificGraph(b).outputs[0].values.slice(0,2),a.values.slice(0,2));
 for(const window of [0,-1,1.5,5])assert.throws(()=>executeScientificGraph({...d,nodes:[d.nodes[0],{...d.nodes[1],window}]}));
});
test('fixed mathematical models compose and never fit to later labels',()=>{
 const d=graph([source('s','dimensionless',[0,.5,1]),{id:'a',kind:'model',model:'affine',parameters:{gain:2,offset:1}},{id:'b',kind:'model',model:'landau-map',parameters:{mu:0,beta:1}}],[edge('s','a'),edge('a','b')],[{node:'a',port:'value'},{node:'b',port:'value'}]);
 const r=executeScientificGraph(d);assert.deepEqual(r.outputs[0].values,[1,2,3]);assert.deepEqual(r.outputs[1].values,[0,-6,-24]);
 const logistic=graph([d.nodes[0],{id:'l',kind:'model',model:'logistic-map',parameters:{r:4}}],[edge('s','l')]);assert.deepEqual(executeScientificGraph(logistic).outputs[0].values,[0,1,0]);
 const unit=structuredClone(d);unit.nodes[0].unit='m';assert.throws(()=>executeScientificGraph(unit));
});
test('overlay and comparison publish named typed outputs and final-time summaries',()=>{
 const d=graph([source('a','m',[1,4,7]),source('b','m',[0,2,3]),{id:'o',kind:'overlay'},{id:'c',kind:'compare'}],[edge('a','o','a'),edge('b','o','b'),edge('o','c','a'),edge('o','c','b','reference')],[{node:'o',port:'value'},{node:'o',port:'reference'},{node:'c',port:'value'},{node:'c',port:'mae'},{node:'c',port:'rmse'}]);
 const r=executeScientificGraph(d);assert.deepEqual(r.outputs[2].values,[1,2,4]);assert.ok(Math.abs(r.outputs[3].values[0]-7/3)<1e-15);assert.ok(Math.abs(r.outputs[4].values[0]-Math.sqrt(7))<1e-12);assert.equal(r.outputs[4].type,'scalar');assert.deepEqual(r.outputs[4].timestamps,[2000]);assert.deepEqual(r.outputs[4].availableAt,[2000]);
 assert.ok(r.trace.find(t=>t.node==='c').portOutputs.some(p=>p.port==='mae'));
 assert.deepEqual(r,executeScientificGraph({...d,nodes:[...d.nodes].reverse(),edges:[...d.edges].reverse()}));
});
test('new operations reject mismatched axes, units, unknown ports and cycles',()=>{
 const d=graph([source('a','m',[1,2]),source('b','s',[1,2]),{id:'c',kind:'compare'}],[edge('a','c','a'),edge('b','c','b')]);assert.throws(()=>executeScientificGraph(d));
 d.nodes[1].unit='m';d.nodes[1].timestamps=[0,2000];assert.throws(()=>executeScientificGraph(d));
 d.nodes[1]=source('b','m',[1,2]);d.outputs=[{node:'c',port:'missing'}];assert.throws(()=>executeScientificGraph(d));
 const cycle=graph([{id:'a',kind:'rolling-mean',window:1},{id:'b',kind:'rolling-mean',window:1}],[edge('a','b'),edge('b','a')]);assert.throws(()=>executeScientificGraph(cycle),/CYCLE/);
});
test('book-derived dimensional formula pins full source definition and stays NOT_VERIFIED',()=>{
 const r={id:'book',sourceId:'synthetic-book',source:{sourceHash:hash,edition:'e1',page:17,extractionVersion:'v1',text:'Synthetic squared relation'},status:'SOURCE_REVIEWED',expression:'x^2',inputUnit:'m',outputUnit:'m^2',hypothesis:'Synthetic relation, not a law',confidence:'NOT_VERIFIED'};
 const catalog=createScientificCatalog([r]);const reference=catalog.describe()[0];const d=graph([source('s','m',[2,3]),{id:'k',kind:'knowledge',reference:{id:reference.id,sha256:reference.sha256}}],[edge('s','k')]);
 const result=executeScientificGraph(d,{catalog});assert.deepEqual(result.outputs[0].values,[4,9]);assert.equal(result.mathematicallyVerified,false);assert.equal(result.trace[1].knowledge.source.page,17);assert.equal(result.trace[1].knowledge.confidence,'NOT_VERIFIED');assert.equal(Object.hasOwn(result.trace[1].knowledge.source,'text'),false);
 assert.throws(()=>executeScientificGraph(d,{catalog:createScientificCatalog([{...r,source:{...r.source,edition:'e2'}}])}));
});
test('comparison aggregates cannot be smuggled into an earlier time series',()=>{
 const d=graph([source('a','m',[1,2,3]),source('b','m',[0,0,0]),{id:'c',kind:'compare'},{id:'sum',kind:'sum'}],[edge('a','c','a'),edge('b','c','b'),edge('a','sum','a'),edge('c','sum','b','mae')]);assert.throws(()=>executeScientificGraph(d),/MISALIGNED/);
});
test('new operation capability lists cannot mutate engine definitions',()=>{
 const a=scientificCapabilities();assert.equal(a.apiRevision,'2.1');assert.ok(a.ports.compare.outputs.includes('mae'));a.ports.compare.outputs.reverse();assert.equal(scientificCapabilities().ports.compare.outputs[0],'value');
});
test('rolling work and all multi-output values count against resource budgets',()=>{
 const a=source('a','m',Array(2048).fill(1),Array.from({length:2048},(_,i)=>i));const b={...structuredClone(a),id:'b'};
 assert.throws(()=>executeScientificGraph(graph([a,{id:'r',kind:'rolling-mean',window:1024}],[edge('a','r')])),/COMPUTATION_LIMIT/);
 const d=graph([a,b,{id:'o',kind:'overlay'},{id:'c',kind:'compare'},{id:'z',kind:'overlay'}],[edge('a','o','a'),edge('b','o','b'),edge('o','c','a'),edge('o','c','b','reference'),edge('c','z','a'),edge('c','z','b','absolute')]);assert.throws(()=>executeScientificGraph(d),/COMPUTATION_LIMIT/);
});
test('calculus, comparison, sum and model nonfinite intermediates fail closed',()=>{
 for(const kind of ['derivative','integral']){
  const values=kind==='derivative'?[-1e308,1e308]:[1e308,1e308];const d=graph([source('s','m',values,[0,10000]),{id:'f',kind,outputUnit:kind==='derivative'?'m/s':'m*s'}],[edge('s','f')]);assert.throws(()=>executeScientificGraph(d),/NONFINITE/);
 }
 for(const kind of ['sum','compare'])assert.throws(()=>executeScientificGraph(graph([source('a','m',[1e308]),source('b','m',[kind==='sum'?1e308:-1e308]),{id:'f',kind}],[edge('a','f','a'),edge('b','f','b')])),/NONFINITE/);
 const m=graph([source('s','dimensionless',[1e200]),{id:'f',kind:'model',model:'landau-map',parameters:{mu:1,beta:1}}],[edge('s','f')]);assert.throws(()=>executeScientificGraph(m),/NONFINITE/);
 for(const parameters of [{mu:0,beta:-1},{mu:NaN,beta:1},{mu:1,beta:1,extra:0}])assert.throws(()=>executeScientificGraph({...m,nodes:[m.nodes[0],{...m.nodes[1],parameters}]}));
});
test('irregular-time scaled calculus is causal under suffix mutation',()=>{
 const d=graph([source('s','km',[0,2,6,12],[0,1000,3000,6000]),{id:'r',kind:'derivative',outputUnit:'m/s'},{id:'i',kind:'integral',outputUnit:'m*s'}],[edge('s','r'),edge('s','i')],[{node:'r',port:'value'},{node:'i',port:'value'}]);
 const a=executeScientificGraph(d);assert.deepEqual(a.outputs[0].values,[2000,2000,2000]);assert.deepEqual(a.outputs[1].values,[0,1000,9000,36000]);
 const changed=structuredClone(d);changed.nodes[0].values[3]=1200;const b=executeScientificGraph(changed);assert.deepEqual(a.outputs[0].values.slice(0,2),b.outputs[0].values.slice(0,2));assert.deepEqual(a.outputs[1].values.slice(0,3),b.outputs[1].values.slice(0,3));
});
test('final comparison availability survives downstream formula/model/conversion',()=>{
 const d=graph([source('a','m',[1,2,3]),source('b','m',[0,0,0]),{id:'c',kind:'compare'},{id:'f',kind:'formula',expression:'x*2',outputUnit:'m'},{id:'m',kind:'model',model:'affine',parameters:{gain:1,offset:1}},{id:'cm',kind:'convert',unit:'cm'}],[edge('a','c','a'),edge('b','c','b'),edge('c','f','x','mae'),edge('f','m'),edge('m','cm')]);
 const output=executeScientificGraph(d).outputs[0];assert.equal(output.type,'scalar');assert.deepEqual(output.values,[500]);assert.deepEqual(output.timestamps,[2000]);assert.deepEqual(output.availableAt,[2000]);
});
test('unit grammar complexity and versioned metadata requests fail closed',()=>{
 assert.equal(unitSpec('m^8*m^8').dimensions[0],16);
 for(const unit of ['m^8*m^8*m',Array(9).fill('m').join('*'),'m*'.repeat(49)+'m'])assert.throws(()=>unitSpec(unit));
 const request={schema:'math.units.describe.v1',execution_authority:false,units:['kg*m^2/s^2','J']};const r=evaluateUnitRequest(request);assert.deepEqual(r.units[0].dimensions,r.units[1].dimensions);
 for(const bad of [{...request,units:['m','m']},{...request,execution_authority:true},{...request,extra:1},{...request,units:['USD/FAKE']},{...request,units:[]}])assert.throws(()=>evaluateUnitRequest(bad));
});
test('comparison RMS handles finite extreme residuals without squaring overflow',()=>{
 const d=graph([source('a','m',[1e308,1e308]),source('b','m',[0,0]),{id:'c',kind:'compare'}],[edge('a','c','a'),edge('b','c','b')],[{node:'c',port:'rmse'}]);assert.deepEqual(executeScientificGraph(d).outputs[0].values,[1e308]);
});
test('published synthetic composition result reproduces with identical provenance digests',()=>{
 const document=JSON.parse(readFileSync(new URL('../examples/scientific-composition.v21.json',import.meta.url)));
 const expected=JSON.parse(readFileSync(new URL('../docs/audits/scientific-composition-v21/EXAMPLE_RESULT.json',import.meta.url)));delete expected.kind;delete expected.physical;
 assert.deepEqual(executeScientificGraph(document),expected);
});
test('existing methods respect newly supported scaled dimensionless units',()=>{
 const d=graph([source('s','cm/m',[100]),{id:'f',kind:'method',method:'sine',parameter:1}],[edge('s','f')]);const o=executeScientificGraph(d).outputs[0];assert.equal(o.unit,'cm/m');assert.ok(Math.abs(o.values[0]-Math.sin(1)/.01)<1e-12);
});
test('Gaussian method cannot hide an infinite intermediate behind finite exp(-Infinity)',()=>{
 const d=graph([source('s','dimensionless',[1e200]),{id:'f',kind:'method',method:'gaussian',parameter:1}],[edge('s','f')]);assert.throws(()=>executeScientificGraph(d),/NONFINITE/);
});
