// Pure adapter proposal planner. No dynamic evaluation, network access or code generation.
const supported=new Set(['unit-conversion','equivalent-concept','formula-substitution','requires-assumption']);
function text(value,label){if(typeof value!=='string'||!value.trim()||value.length>256)throw Error('Invalid '+label);return value.trim()}
function source(value,label){if(!value||typeof value!=='object')throw Error('Missing '+label);return Object.freeze({id:text(value.id,label+' id'),referenceId:text(value.referenceId,label+' reference'),locator:text(value.locator,label+' locator')})}
export function proposeKnowledgeAdapter({from,to,relation,assumptions=[],evidence=[]}={}){
 const a=source(from,'source'),b=source(to,'target');
 if(a.id===b.id)throw Error('Self adapter not allowed');
 if(!supported.has(relation))throw Error('Unsupported adapter relation');
 if(!Array.isArray(assumptions)||assumptions.length>16||!Array.isArray(evidence)||evidence.length>32)throw Error('Invalid proposal bounds');
 const conditions=assumptions.map(x=>text(x,'assumption'));
 const proof=evidence.map(x=>source(x,'evidence'));
 const blockers=[];
 if(!proof.length)blockers.push('missing-independent-evidence');
 if(relation==='formula-substitution'&&!conditions.length)blockers.push('missing-substitution-assumptions');
 return Object.freeze({
  schema:'math-universe-adapter-proposal/v1',
  from:a,to:b,relation,assumptions:Object.freeze(conditions),evidence:Object.freeze(proof),
  status:'review_required',blockers:Object.freeze(blockers),
  executable:false,reviewed:false
 });
}
export function makeCodexAdapterTask(proposal){
 if(!proposal||proposal.schema!=='math-universe-adapter-proposal/v1'||proposal.executable!==false||proposal.status!=='review_required')throw Error('Invalid proposal');
 return Object.freeze({
  schema:'math-universe-codex-adapter-task/v1',
  task:'propose-declarative-adapter',
  constraints:Object.freeze(['no-eval','no-network','no-arbitrary-code-execution','human-review-required','test-dimensional-consistency','preserve-source-provenance']),
  proposal:structuredClone(proposal)
 });
}
