// A typed, provenance-preserving directed acyclic graph of scientific experiments.
// Multiple inputs are permitted only for adapters that explicitly declare their
// input ports and their combining operation.
export function createExperimentGraph({adapters=[]}={}){
 const catalog=new Map();
 for(const a of adapters){if(!a||typeof a.id!=='string'||catalog.has(a.id)||!Array.isArray(a.inputs)||typeof a.output!=='string'||typeof a.run!=='function')throw Error('Invalid graph adapter');catalog.set(a.id,a)}
 const nodes=new Map();
 return {
  addSource(id,type,value,{metadata={}}={}){
   if(typeof id!=='string'||!id||nodes.has(id)||typeof type!=='string'||!type)throw Error('Invalid or duplicate node');
   nodes.set(id,{id,type,value,metadata,kind:'source'});return id;
  },
  addTransform(id,adapterId,inputs,{parameters={}}={}){
   if(typeof id!=='string'||!id||nodes.has(id)||!catalog.has(adapterId))throw Error('Invalid transform node');
   const adapter=catalog.get(adapterId);
   if(!Array.isArray(inputs)||inputs.length!==adapter.inputs.length||inputs.some((ref,i)=>!nodes.has(ref)||nodes.get(ref).type!==adapter.inputs[i]))throw Error('Incompatible input ports');
   nodes.set(id,{id,type:adapter.output,adapterId,inputs:inputs.slice(),parameters,kind:'transform'});return id;
  },
  execute(id){
   if(!nodes.has(id))throw Error('Unknown node');
   const cache=new Map(),active=new Set();
   function evaluate(key){
    if(cache.has(key))return cache.get(key);
    if(active.has(key))throw Error('Cycle detected');
    active.add(key);
    const node=nodes.get(key);let value,trace;
    if(node.kind==='source'){value=node.value;trace=[{node:key,type:node.type,kind:'source',metadata:node.metadata}]}
    else{const adapter=catalog.get(node.adapterId),parents=node.inputs.map(evaluate);value=adapter.run(parents.map(p=>p.value),node.parameters);if(value===undefined||value===null)throw Error('Empty adapter output: '+adapter.id);trace=[...parents.flatMap(p=>p.trace),{node:key,type:node.type,kind:'transform',adapter:adapter.id,inputs:node.inputs.slice(),parameters:node.parameters}]}
    const result={id:key,type:node.type,value,trace};cache.set(key,result);active.delete(key);return result;
   }
   return evaluate(id);
  },
  describe(){return [...nodes.values()].map(n=>({id:n.id,type:n.type,kind:n.kind,adapterId:n.adapterId??null,inputs:n.inputs??[]}))},
  listAdapters(){return [...catalog.values()].map(({id,inputs,output,description})=>({id,inputs,output,description}))}
 };
}
export function createScientificExperimentGraph(){
 return createExperimentGraph({adapters:[
  {id:'series-difference',inputs:['time-series','time-series'],output:'comparison-series',description:'Pointwise difference of aligned observations',run:([a,b])=>{if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||a.some(v=>!Number.isFinite(v))||b.some(v=>!Number.isFinite(v)))throw Error('Series must be finite and index-aligned');return a.map((v,i)=>v-b[i])}},
  {id:'series-average',inputs:['time-series','time-series'],output:'time-series',description:'Arithmetic mean of index-aligned observations (same units required)',run:([a,b],p)=>{if(p.unitsA!==p.unitsB||typeof p.unitsA!=='string'||!p.unitsA)throw Error('Matching units must be declared');if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||a.some(v=>!Number.isFinite(v))||b.some(v=>!Number.isFinite(v)))throw Error('Series must be finite and aligned');return a.map((v,i)=>(v+b[i])/2)}},
  {id:'comparison-energy',inputs:['comparison-series'],output:'scalar',description:'Mean squared difference of aligned observations',run:([a])=>{if(!Array.isArray(a)||a.length===0||a.some(v=>!Number.isFinite(v)))throw Error('Invalid comparison series');return a.reduce((s,v)=>s+v*v,0)/a.length}}
 ]});
}
