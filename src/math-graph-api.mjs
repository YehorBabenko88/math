import {createScientificExperimentGraph} from './experiment-graph.mjs';
const kinds=new Set(['prices','returns','difference','energy']);
export function evaluateResearchGraph(body){
 if(!body||Object.keys(body).sort().join(',')!=='execution_authority,mode,nodes,schema'||
 body.schema!=='math.graph.execute.v1'||body.mode!=='HISTORICAL_RESEARCH'||body.execution_authority!==false||
 !Array.isArray(body.nodes)||body.nodes.length<2||body.nodes.length>12)throw Error('INVALID_GRAPH');
 const graph=createScientificExperimentGraph();
 const descriptions=[];
 for(const n of body.nodes){
  if(!n||typeof n.id!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(n.id))throw Error('INVALID_NODE');
  if(n.kind==='source'){
   if(Object.keys(n).sort().join(',')!=='id,kind,values'||!Array.isArray(n.values)||
    n.values.length<2||n.values.length>2000||n.values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('INVALID_SOURCE');
   graph.addSource(n.id,'time-series',n.values,{metadata:{attested:false}});
  }else if(n.kind==='transform'){
   if(Object.keys(n).sort().join(',')!=='adapter,id,inputs,kind,parameters'||!['series-average','series-difference','comparison-energy'].includes(n.adapter)||
   !Array.isArray(n.inputs)||!n.parameters||typeof n.parameters!=='object')throw Error('INVALID_TRANSFORM');
   graph.addTransform(n.id,n.adapter,n.inputs,{parameters:n.parameters});
  }else throw Error('INVALID_NODE_KIND');
  descriptions.push(n.id);
 }
 const last=graph.execute(descriptions.at(-1));
 if((Array.isArray(last.value)?last.value:[last.value]).some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('NONFINITE_RESULT');
 if(!['time-series','comparison-series','scalar'].includes(last.type))throw Error('INVALID_RESULT');
 if(Array.isArray(last.value)&&last.value.length>2000)throw Error('OVERSIZE_RESULT');
 return {schema:'math.graph.result.v1',status:'RESEARCH_ONLY',source:'CALLER_SUPPLIED_UNATTESTED',
  output:{id:last.id,type:last.type,values:last.value},trace:last.trace.map(x=>({id:x.node,kind:x.kind,type:x.type})),
  trading_authorized:false,training_authorized:false,execution_authority:false};
}
