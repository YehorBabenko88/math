// Safe import of an adapter registry snapshot via the public state machine.
// Import fails closed on malformed records, inconsistent IDs or impossible review states.
import {createKnowledgeAdapterRegistry} from './knowledge-adapter-registry.mjs';
export function restoreKnowledgeAdapterRegistry(json){
 if(typeof json!=='string'||json.length>5_000_000)throw Error('Invalid registry snapshot size');
 const data=JSON.parse(json);
 if(!data||data.schema!=='math-universe-adapter-registry/v1'||!Array.isArray(data.records)||data.records.length>10000)throw Error('Invalid registry snapshot');
 const registry=createKnowledgeAdapterRegistry();
 const seen=new Set();
 for(const item of data.records){
  if(!item||typeof item.id!=='string'||seen.has(item.id)||!['proposed','validated','approved','rejected'].includes(item.state))throw Error('Invalid registry record');
  seen.add(item.id);
  const created=registry.propose(item.proposal);
  if(created.id!==item.id)throw Error('Registry fingerprint mismatch');
  if(item.state!=='proposed'){
   if(!item.validation||typeof item.validation.passed!=='boolean'||!Array.isArray(item.validation.checks))throw Error('Missing validation');
   registry.validate(item.id,item.validation);
  }else if(item.validation!==null||item.review!==null)throw Error('Unexpected review data');
  if(item.state==='approved'||item.state==='rejected'){
   if(!item.review||typeof item.review.approved!=='boolean'||(item.review.approved!==(item.state==='approved')))throw Error('Invalid review status');
   registry.review(item.id,item.review);
  }else if(item.review!==null)throw Error('Unexpected review');
 }
 return registry;
}
