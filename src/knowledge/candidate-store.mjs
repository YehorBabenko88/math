import {createCandidate,createEdge} from './candidate-graph.mjs';
export class CandidateGraph {
 #revisions=new Map(); #entities=new Map(); #edges=new Map();
 addCandidate(input) {
  const candidate=createCandidate(input);
  const priorEntity=this.#entities.get(candidate.entity_id)||[];
  if(priorEntity.length) {
   const original=this.#revisions.get(priorEntity[0]);
   if(original.kind!==candidate.kind) throw Error('entity kind conflict');
  }
  const old=this.#revisions.get(candidate.revision_id);
  if(old) {
   if(old.entity_id!==candidate.entity_id) throw Error('revision entity conflict');
   return structuredClone(old);
  }
  this.#revisions.set(candidate.revision_id,candidate);
  this.#entities.set(candidate.entity_id,[...priorEntity,candidate.revision_id]);
  return structuredClone(candidate);
 }
 getRevision(id) {const value=this.#revisions.get(id);return value?structuredClone(value):null;}
 history(id) {return (this.#entities.get(id)||[]).map(key=>structuredClone(this.#revisions.get(key)));}
 addEdge(input) {
  const edge=createEdge(input);
  if(!this.#revisions.has(edge.from_revision)||!this.#revisions.has(edge.to_revision)) throw Error('dangling edge');
  if(edge.type==='DEPENDS_ON') {
   if(edge.from_revision===edge.to_revision) throw Error('dependency cycle');
   const seen=new Set(),stack=[edge.to_revision];
   while(stack.length) {
    const node=stack.pop();
    if(node===edge.from_revision) throw Error('dependency cycle');
    if(seen.has(node)) continue;
    seen.add(node);
    for(const e of this.#edges.values()) if(e.type==='DEPENDS_ON'&&e.from_revision===node) stack.push(e.to_revision);
   }
  }
  const key=JSON.stringify([edge.type,edge.from_revision,edge.to_revision]);
  this.#edges.set(key,edge);
  return structuredClone(edge);
 }
 dependencies(id) {
  if(!this.#revisions.has(id)) throw Error('unknown revision');
  return [...this.#edges.values()].filter(e=>e.type==='DEPENDS_ON'&&e.from_revision===id).map(edge=>structuredClone(edge));
 }
 conflicts() {return [...this.#edges.values()].filter(e=>e.type==='CONTRADICTS').map(e=>({left:e.from_revision,right:e.to_revision,status:'UNRESOLVED'}));}
}
