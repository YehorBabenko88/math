import {assessKnowledge} from './book-ingestion/knowledge-boundary.mjs';
import {createScientificExperimentGraph} from './experiment-graph.mjs';
import {evaluateFunction} from './math.mjs';
import {listSIUnits} from './si-dimensions.mjs';
import {concepts} from './knowledge.mjs';
import {snapshotJSON,exact,text,digest,fingerprint} from './scientific-data.mjs';
import {unitSpec,sameDimensions,compileDimensionalFormula} from './scientific-units.mjs';

export const SCIENTIFIC_LIMITS=Object.freeze({nodes:128,edges:256,points:2048,totalValues:16384,operations:1000000,requestBytes:262144,responseBytes:2097152});
const catalogs=new WeakMap();
function publicKnowledge(record){
 const {source,...metadata}=record;const {text:privateText,...location}=source;
 return {...structuredClone(metadata),source:{...location}};
}
// Trusted host configuration only. No HTTP endpoint installs caller catalogs.
export function createScientificCatalog(input=[]){
 const records=snapshotJSON(input);if(!Array.isArray(records)||records.length>64)throw Error('CATALOG_LIMIT');
 const map=new Map();
 for(const r of records){
  exact(r,['id','sourceId','source','status','expression','inputUnit','outputUnit','hypothesis','confidence'],['conceptId']);
  text(r.id);text(r.sourceId);text(r.hypothesis,2000);if(r.confidence!=='NOT_VERIFIED'||map.has(r.id))throw Error('UNVERIFIED_SOURCE_REQUIRED');
  const assessment=assessKnowledge({source:r.source,status:r.status});
  if(!['SOURCE_REVIEWED','FORMALIZED'].includes(r.status))throw Error('SOURCE_REVIEW_REQUIRED');
  if(r.conceptId!==undefined&&!concepts.some(c=>c.id===r.conceptId))throw Error('UNKNOWN_CONCEPT');
  compileDimensionalFormula(r.expression,r.inputUnit,r.outputUnit);
  map.set(r.id,{...r,sha256:fingerprint(r),candidateDigest:assessment.candidateDigest,mathematicallyVerified:false});
 }
 const handle=Object.freeze({describe:()=>[...map.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(publicKnowledge)});catalogs.set(handle,map);return handle;
}
const emptyCatalog=createScientificCatalog();
function identifier(id){if(typeof id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(id))throw Error('INVALID_ID');return id;}
const ports={source:[],formula:['x'],knowledge:['x'],convert:['x'],lag:['x'],method:['x'],difference:['a','b'],average:['a','b'],multiply:['a','b'],divide:['a','b']};
function timestamp(t){if(!Number.isSafeInteger(t)||t<0)throw Error('INVALID_TIMESTAMP');return t;}
function source(n,asOf){
 const series=n.type==='series';
 exact(n,['id','kind','type','unit','provenance',...(series?['values','timestamps','availableAt']:['value','timestamp','availableAt'])]);
 if(!series&&n.type!=='scalar')throw Error('INVALID_TYPE');unitSpec(n.unit);
 exact(n.provenance,['sourceId','version','sha256']);text(n.provenance.sourceId);text(n.provenance.version);digest(n.provenance.sha256);
 const values=series?n.values:[n.value],times=series?n.timestamps:[n.timestamp],availability=series?n.availableAt:[n.availableAt];
 if(!Array.isArray(values)||values.length<1||values.length>SCIENTIFIC_LIMITS.points||!Array.isArray(times)||!Array.isArray(availability)||times.length!==values.length||availability.length!==values.length)throw Error('INVALID_SERIES');
 for(let i=0;i<values.length;i++){
  if(typeof values[i]!=='number'||!Number.isFinite(values[i]))throw Error('NONFINITE_SOURCE');timestamp(times[i]);timestamp(availability[i]);
  if(times[i]>asOf||availability[i]>times[i]||i&&times[i]<=times[i-1])throw Error('NONCAUSAL_SOURCE');
 }
 return {type:n.type,unit:n.unit,values:[...values],timestamps:[...times],availableAt:[...availability]};
}
function aligned(a,b){if(a.type!==b.type||a.values.length!==b.values.length||a.timestamps.some((t,i)=>t!==b.timestamps[i]))throw Error('MISALIGNED_INPUTS');}
function binaryLegacy(kind,a,b){const g=createScientificExperimentGraph();g.addSource('a','time-series',a);g.addSource('b','time-series',b);g.addTransform('out',kind==='average'?'series-average':'series-difference',['a','b'],{parameters:{unitsA:'same',unitsB:'same'}});return g.execute('out').value;}
export function executeScientificGraph(input,{catalog=emptyCatalog}={}){
 const d=snapshotJSON(input);exact(d,['schema','mode','execution_authority','asOf','nodes','edges','outputs']);
 if(d.schema!=='math.scientific.graph.v2'||d.mode!=='HISTORICAL_RESEARCH'||d.execution_authority!==false)throw Error('INVALID_CONTRACT');timestamp(d.asOf);
 if(!Array.isArray(d.nodes)||d.nodes.length<1||d.nodes.length>SCIENTIFIC_LIMITS.nodes||!Array.isArray(d.edges)||d.edges.length>SCIENTIFIC_LIMITS.edges||!Array.isArray(d.outputs)||d.outputs.length<1||d.outputs.length>128)throw Error('GRAPH_LIMIT');
 const library=catalogs.get(catalog);if(!library)throw Error('UNTRUSTED_CATALOG');
 const nodes=new Map(),incoming=new Map(),outgoing=new Map(),indegree=new Map();
 for(const n of d.nodes){identifier(n.id);if(nodes.has(n.id)||!Object.hasOwn(ports,n.kind))throw Error('INVALID_NODE');nodes.set(n.id,n);incoming.set(n.id,new Map());outgoing.set(n.id,[]);indegree.set(n.id,0);}
 for(const e of d.edges){
  exact(e,['from','to']);exact(e.from,['node','port']);exact(e.to,['node','port']);
  if(!nodes.has(e.from.node)||!nodes.has(e.to.node)||e.from.port!=='value'||!ports[nodes.get(e.to.node).kind].includes(e.to.port)||incoming.get(e.to.node).has(e.to.port))throw Error('INVALID_PORT');
  incoming.get(e.to.node).set(e.to.port,e.from.node);outgoing.get(e.from.node).push(e.to.node);indegree.set(e.to.node,indegree.get(e.to.node)+1);
 }
 for(const [id,n] of nodes)if(incoming.get(id).size!==ports[n.kind].length)throw Error('MISSING_PORT');
 const ready=[...nodes.keys()].filter(id=>indegree.get(id)===0).sort(),order=[];
 while(ready.length){const id=ready.shift();order.push(id);for(const next of outgoing.get(id)){indegree.set(next,indegree.get(next)-1);if(indegree.get(next)===0){ready.push(next);ready.sort();}}}
 if(order.length!==nodes.size)throw Error('GRAPH_CYCLE');
 const seenOutputs=new Set();for(const o of d.outputs){exact(o,['node','port']);if(!nodes.has(o.node)||o.port!=='value'||seenOutputs.has(o.node))throw Error('INVALID_OUTPUT');seenOutputs.add(o.node);}
 let count=0,operations=0;const results=new Map(),trace=[];
 for(const id of order){
  const n=nodes.get(id),dependencies=ports[n.kind].map(port=>({port,node:incoming.get(id).get(port),output:'value',sha256:trace.find(t=>t.node===incoming.get(id).get(port)).outputSHA256}));
  const args=dependencies.map(p=>results.get(p.node));let result,knowledge=null,cost=1;
  if(n.kind==='source')result=source(n,d.asOf);
  else{
   const a=args[0];let values,unit=a.unit,times=a.timestamps,availability=a.availableAt;
   if(n.kind==='formula'||n.kind==='knowledge'){
    let expression,outputUnit;
    if(n.kind==='formula'){exact(n,['id','kind','expression','outputUnit']);({expression,outputUnit}=n);}
    else{exact(n,['id','kind','reference']);exact(n.reference,['id','sha256']);digest(n.reference.sha256);const r=library.get(n.reference.id);if(!r||r.sha256!==n.reference.sha256)throw Error('SOURCE_BINDING_MISMATCH');if(r.inputUnit!==a.unit)throw Error('SOURCE_INPUT_UNIT_MISMATCH');knowledge=publicKnowledge(r);({expression,outputUnit}=r);}
    const fn=compileDimensionalFormula(expression,a.unit,outputUnit);cost=fn.cost;values=a.values.map(x=>fn.evaluate(x));unit=outputUnit;
   }else if(n.kind==='convert'){
    exact(n,['id','kind','unit']);const from=unitSpec(a.unit),to=unitSpec(n.unit);if(!sameDimensions(from.dimensions,to.dimensions))throw Error('INCOMPATIBLE_UNITS');
    values=a.values.map(x=>x*from.factor/to.factor);unit=n.unit;
   }else if(n.kind==='lag'){
    exact(n,['id','kind','steps']);if(a.type!=='series'||!Number.isSafeInteger(n.steps)||n.steps<1||n.steps>=a.values.length)throw Error('INVALID_LAG');values=a.values.slice(0,-n.steps);times=a.timestamps.slice(n.steps);availability=a.availableAt.slice(0,-n.steps);
   }else if(n.kind==='method'){
    exact(n,['id','kind','method','parameter']);if(!['polynomial','sine','gaussian'].includes(n.method)||!Number.isFinite(n.parameter)||Math.abs(n.parameter)>1e6||!sameDimensions(unitSpec(unit).dimensions,Array(10).fill(0)))throw Error('INVALID_METHOD');values=a.values.map(x=>evaluateFunction(n.method,x,n.parameter));cost=8;
   }else{
    const b=args[1];aligned(a,b);availability=a.availableAt.map((v,i)=>Math.max(v,b.availableAt[i]));
    if(n.kind==='average'||n.kind==='difference'){
     exact(n,['id','kind']);if(a.unit!==b.unit)throw Error('EXPLICIT_CONVERSION_REQUIRED');values=binaryLegacy(n.kind,a.values,b.values);
    }else{
     exact(n,['id','kind','outputUnit']);const ua=unitSpec(a.unit),ub=unitSpec(b.unit),out=unitSpec(n.outputUnit),sign=n.kind==='multiply'?1:-1;
     if(!sameDimensions(ua.dimensions.map((x,i)=>x+sign*ub.dimensions[i]),out.dimensions))throw Error('OUTPUT_DIMENSION_MISMATCH');
     values=a.values.map((v,i)=>{const x=v*ua.factor,y=b.values[i]*ub.factor;if(!Number.isFinite(x)||!Number.isFinite(y)||sign===-1&&y===0)throw Error('NONFINITE_ARITHMETIC');return (sign===1?x*y:x/y)/out.factor;});unit=n.outputUnit;
    }
   }
   result={type:a.type,unit,values,timestamps:[...times],availableAt:[...availability]};
  }
  count+=result.values.length;operations+=result.values.length*cost;
  if(count>SCIENTIFIC_LIMITS.totalValues||operations>SCIENTIFIC_LIMITS.operations)throw Error('COMPUTATION_LIMIT');
  if(result.values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('NONFINITE_RESULT');
  results.set(id,result);trace.push({node:id,kind:n.kind,definitionSHA256:fingerprint(n),dependencies,unit:result.unit,type:result.type,provenance:n.kind==='source'?n.provenance:null,knowledge,outputSHA256:fingerprint(result)});
 }
 const normalized={...d,nodes:[...d.nodes].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),edges:[...d.edges].sort((a,b)=>fingerprint(a)<fingerprint(b)?-1:fingerprint(a)>fingerprint(b)?1:0)};
 const outputs=d.outputs.map(o=>({node:o.node,port:o.port,...results.get(o.node)}));
 operations+=outputs.reduce((sum,o)=>sum+o.values.length,0);if(operations>SCIENTIFIC_LIMITS.operations)throw Error('COMPUTATION_LIMIT');
 const summaries=outputs.map(o=>{const mean=o.values.reduce((s,v)=>s+v/o.values.length,0);if(!Number.isFinite(mean))throw Error('NONFINITE_METRIC');return {node:o.node,port:o.port,unit:o.unit,count:o.values.length,min:Math.min(...o.values),max:Math.max(...o.values),mean};});
 const result={schema:'math.scientific.result.v2',status:'RESEARCH_ONLY',requestSHA256:fingerprint(normalized),order,outputs,metrics:{kind:'DESCRIPTIVE_OUTPUT_SUMMARIES',outputs:summaries},trace,source:'CALLER_SUPPLIED_UNATTESTED',mathematicallyVerified:false,execution_authority:false,trading_authorized:false,training_authorized:false};
 if(Buffer.byteLength(JSON.stringify(result))>SCIENTIFIC_LIMITS.responseBytes)throw Error('RESPONSE_LIMIT');return result;
}

export function scientificCapabilities({catalog=emptyCatalog}={}){if(!catalogs.has(catalog))throw Error('UNTRUSTED_CATALOG');return {schema:'math.scientific.capabilities.v2',limits:SCIENTIFIC_LIMITS,ports:Object.fromEntries(Object.entries(ports).map(([kind,inputs])=>[kind,{inputs:[...inputs],outputs:['value']}])),units:[...listSIUnits(),'dimensionless','USD','USDT','BTC'],unitMetadata:[...listSIUnits(),'dimensionless','USD','USDT','BTC'].map(unit=>({unit,dimensions:unitSpec(unit).dimensions})),dimensionBasis:['length','mass','time','current','temperature','amount','luminousIntensity','USD','USDT','BTC'],methods:['polynomial','sine','gaussian'],knowledge:catalog.describe(),execution_authority:false,training_authorized:false,trading_authorized:false,mathematicallyVerified:false};}
