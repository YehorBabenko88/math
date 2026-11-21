// Attaches citation identifiers to reproducible experiment nodes without
// interpreting the cited text as executable instructions.
export function createExperimentEvidenceIndex(){
 const records=new Map();
 function checkId(value,label){if(typeof value!=='string'||!value.trim()||value.length>160)throw Error('Invalid '+label)}
 return {
  attach(nodeId,reference,{locator,claim,status='untested'}={}){
   checkId(nodeId,'node id');if(!reference||typeof reference!=='object')throw Error('Invalid reference');
   const refId=reference.arxivId??reference.bookId;
   checkId(refId,'reference id');
   if(typeof locator!=='string'||!locator.trim()||locator.length>160)throw Error('A precise page or section locator is required');
   if(typeof claim!=='string'||!claim.trim()||claim.length>1000)throw Error('A testable claim is required');
   if(!['untested','reproduced','contradicted'].includes(status))throw Error('Invalid evidence status');
   const entry=Object.freeze({nodeId,referenceId:refId,locator,claim,status});
   const list=records.get(nodeId)??[];records.set(nodeId,[...list,entry]);return entry;
  },
  forNode(nodeId){return [...(records.get(nodeId)??[])]},
  exportJSON(){return JSON.stringify({schemaVersion:1,links:[...records.values()].flat()})}
 };
}
export function importExperimentEvidenceIndex(data,{knownNodes,knownReferences}={}){
 const parsed=typeof data==='string'?JSON.parse(data):data;
 if(!parsed||parsed.schemaVersion!==1||!Array.isArray(parsed.links)||parsed.links.length>5000)throw Error('Invalid evidence index');
 const index=createExperimentEvidenceIndex();
 for(const link of parsed.links){
  if(knownNodes&&!knownNodes.includes(link.nodeId))throw Error('Unknown experiment node');
  if(knownReferences&&!knownReferences.includes(link.referenceId))throw Error('Unknown research reference');
  index.attach(link.nodeId,{bookId:link.referenceId},{locator:link.locator,claim:link.claim,status:link.status});
 }
 return index;
}
