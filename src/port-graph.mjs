// Pure typed port-graph compiler. Mathematical execution remains in Math Engine.
const TYPES={source:{out:'time-series',inputs:[]},difference:{out:'comparison-series',inputs:['time-series','time-series']},average:{out:'time-series',inputs:['time-series','time-series']},energy:{out:'scalar',inputs:['comparison-series']}};
export function compilePortGraph(document){
 if(!document||document.schema!=='math.port-graph.v1'||document.execution_authority!==false||
 !Array.isArray(document.nodes)||document.nodes.length<2||document.nodes.length>12||
 !Array.isArray(document.edges)||document.edges.length>24)throw Error('INVALID_GRAPH_DOCUMENT');
 const byId=new Map();
 for(const n of document.nodes){
  if(!n||typeof n.id!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(n.id)||byId.has(n.id)||!Object.hasOwn(TYPES,n.kind))throw Error('INVALID_NODE');
  if(n.kind==='source'&&(!Array.isArray(n.values)||n.values.length<2||n.values.length>2000||n.values.some(v=>typeof v!=='number'||!Number.isFinite(v))))throw Error('INVALID_SERIES');
  if(n.kind!=='source'&&Object.hasOwn(n,'values'))throw Error('UNEXPECTED_VALUES');
  byId.set(n.id,n);
 }
 const ports=new Map();
 for(const e of document.edges){
  if(!e||!byId.has(e.from)||!byId.has(e.to)||!Number.isSafeInteger(e.port)||e.port<0||
   e.port>=TYPES[byId.get(e.to).kind].inputs.length)throw Error('INVALID_EDGE');
  const target=byId.get(e.to),source=byId.get(e.from),key=e.to+':'+e.port;
  if(ports.has(key)||TYPES[source.kind].out!==TYPES[target.kind].inputs[e.port])throw Error('TYPE_OR_PORT_MISMATCH');
  ports.set(key,e.from);
 }
 const state=new Map(),ordered=[];
 function visit(id){
  if(state.get(id)===1)throw Error('GRAPH_CYCLE');
  if(state.get(id)===2)return;
  state.set(id,1);
  const n=byId.get(id),spec=TYPES[n.kind];
  const inputs=spec.inputs.map((_,i)=>{const source=ports.get(id+':'+i);if(!source)throw Error('MISSING_PORT');visit(source);return source});
  ordered.push(n.kind==='source'?{id,kind:'source',values:n.values}:
   {id,kind:'transform',adapter:{difference:'series-difference',average:'series-average',energy:'comparison-energy'}[n.kind],
    inputs,parameters:n.kind==='average'?{unitsA:'dimensionless',unitsB:'dimensionless'}:{}});
  state.set(id,2);
 }
 const outputs=document.nodes.filter(n=>!document.edges.some(e=>e.from===n.id));
 if(outputs.length!==1)throw Error('AMBIGUOUS_OUTPUT');
 visit(outputs[0].id);
 if(ordered.length!==document.nodes.length)throw Error('DISCONNECTED_GRAPH');
 return {schema:'math.graph.execute.v1',mode:'HISTORICAL_RESEARCH',execution_authority:false,nodes:ordered};
}
