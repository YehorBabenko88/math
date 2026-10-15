import {verifyCandidate} from './candidate.mjs';
import {validateReviewDecision} from './review.mjs';
import {freezeJson,canonicalJSON,sha256} from './json.mjs';

// Pure deterministic patch. A trusted caller supplies the reviewed receipt and transactional backend.
export function buildReviewedGraphPatch(candidate,decision,context={}){
 const receipt=validateReviewDecision(candidate,decision,context);
 if(receipt.decision!=='approved')throw Error('Approved human review required');
 const verified=verifyCandidate(candidate,context),p=verified.candidate,digest=verified.digest;
 const nodeCount=1+p.concepts.length+p.formulas.length+p.claims.length+p.evidence.length+verified.report.examples.length;
 const claimEdges=p.claims.reduce((n,c)=>n+c.formulaIds.length+c.conceptIds.length+c.dependencies.length+c.contradictions.length,0);
 const numericEdges=verified.report.examples.reduce((n,e)=>n+p.claims.filter(c=>c.formulaIds.includes(e.formulaId)).length,0);
 const edgeCount=p.concepts.length+p.formulas.length+p.claims.length+p.evidence.length+claimEdges+numericEdges;
 if(nodeCount>10000||edgeCount>20000)throw Error('Graph patch collection limit exceeded');
 const prefix='book:'+digest,version='candidate:'+digest;
 const locator=where=>JSON.stringify({source:p.source,locator:where,extractionVersion:p.extraction.version,textHash64hex:p.extraction.textHash64hex,candidateDigest:digest});
 const provenance=where=>{const exact=locator(where);if(exact.length>2048)throw Error('Graph provenance limit exceeded');return {referenceId:'sha256:'+p.source.hash64hex,locator:exact}};
 const nodes=[],edges=[];
 const id=(type,key)=>prefix+':'+type+':'+key;
 const addNode=(type,key,label,{where=p.locator,status}={})=>{const node={id:id(type,key),type,label,version,provenance:provenance(where)};if(status!==undefined)node.status=status;nodes.push(node);return node.id};
 let sequence=0;
 const addEdge=(type,source,target,where=p.locator)=>edges.push({id:prefix+':edge:'+(sequence++),type,source,target,provenance:provenance(where)});
 const work=addNode('Work','source',p.source.edition);
 for(const c of p.concepts){const concept=addNode('Concept',c.id,c.label+' — '+c.definition);addEdge('has_concept',work,concept)}
 for(const f of p.formulas){const formula=addNode('Formula',f.id,JSON.stringify({formulaId:f.id,outputUnit:f.outputUnit,declarativeFormulaHash:sha256(canonicalJSON(f))}),{status:'untested'});addEdge('states',work,formula)}
 for(const c of p.claims){const claim=addNode('Claim',c.id,c.text,{status:'untested'});addEdge('states',work,claim);for(const key of c.formulaIds)addEdge('uses_formula',claim,id('Formula',key));for(const key of c.conceptIds)addEdge('has_concept',claim,id('Concept',key));for(const key of c.dependencies)addEdge('derives',claim,id('Claim',key));for(const key of c.contradictions)addEdge('contradicts',claim,id('Claim',key))}
 for(const e of p.evidence){const evidence=addNode('Evidence','citation:'+e.id,e.note,{status:'untested',where:e.locator});addEdge('supports',evidence,id('Claim',e.claimId),e.locator)}
 for(const example of verified.report.examples){
  const evidence=addNode('Evidence','numeric:'+example.formulaId+':'+example.index,JSON.stringify({scope:'numeric-examples-only',formulaId:example.formulaId,index:example.index,actual:example.actual,expected:example.expected,passes:example.passes}),{status:'reproduced'});
  for(const claim of p.claims)if(claim.formulaIds.includes(example.formulaId))addEdge('supports',evidence,id('Claim',claim.id));
 }
 return freezeJson({candidateDigest:digest,nodes,edges});
}
export async function importReviewedCandidate(candidate,decision,{repository,context={}}={}){
 if(!repository||typeof repository.transact!=='function')throw Error('Atomic graph repository required');
 const patch=buildReviewedGraphPatch(candidate,decision,context);
 return repository.transact(async tx=>{
  if(!tx||['hasImport','addNode','addEdge','markImported'].some(k=>typeof tx[k]!=='function'))throw Error('Invalid graph repository transaction');
  const previous=await tx.hasImport(patch.candidateDigest);if(typeof previous!=='boolean')throw Error('Invalid graph repository ledger');
  if(previous)return {imported:false,candidateDigest:patch.candidateDigest,nodes:0,edges:0};
  for(const node of patch.nodes)await tx.addNode(node);
  for(const edge of patch.edges)await tx.addEdge(edge);
  await tx.markImported(patch.candidateDigest);
  return {imported:true,candidateDigest:patch.candidateDigest,nodes:patch.nodes.length,edges:patch.edges.length};
 });
}
