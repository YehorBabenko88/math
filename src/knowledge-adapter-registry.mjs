// Immutable proposal registry with explicit, provenance-preserving review.
// Approved means reviewed for use in this registry, not mathematically proven.
import {createHash} from 'node:crypto';
const states=new Set(['proposed','validated','approved','rejected']);
const canonical=value=>JSON.stringify(value);
function fingerprint(value){return createHash('sha256').update(canonical(value)).digest('hex')}
function nonempty(value,label){if(typeof value!=='string'||!value.trim()||value.length>1000)throw Error('Invalid '+label);return value.trim()}
export function createKnowledgeAdapterRegistry(){
 const records=new Map();
 function get(id){const record=records.get(id);if(!record)throw Error('Unknown adapter');return record}
 function snapshot(record){return structuredClone(record)}
 return Object.freeze({
  propose(proposal){
   if(!proposal||proposal.schema!=='math-universe-adapter-proposal/v1'||proposal.executable!==false||proposal.status!=='review_required'||!Array.isArray(proposal.blockers)||!Array.isArray(proposal.evidence))throw Error('Invalid adapter proposal');
   const input=structuredClone(proposal);
   const id=fingerprint(input);
   if(records.has(id))return snapshot(get(id));
   const record={id,proposal:input,state:'proposed',validation:null,review:null};
   records.set(id,record);return snapshot(record);
  },
  validate(id,{passed,checks}={}){
   const r=get(id);if(r.state!=='proposed')throw Error('Invalid adapter state');
   if(typeof passed!=='boolean'||!Array.isArray(checks)||!checks.length||checks.length>64||checks.some(x=>typeof x!=='string'||!x.trim()))throw Error('Invalid validation');
   r.validation={passed,checks:checks.map(x=>nonempty(x,'check'))};
   r.state='validated';return snapshot(r);
  },
  review(id,{approved,reviewer,reason}={}){
   const r=get(id);if(r.state!=='validated')throw Error('Adapter not validated');
   if(typeof approved!=='boolean')throw Error('Invalid review');
   reviewer=nonempty(reviewer,'reviewer');reason=nonempty(reason,'reason');
   if(approved&&(!r.validation.passed||r.proposal.blockers.length||!r.proposal.evidence.length))throw Error('Adapter has unresolved validation blockers');
   r.review={approved,reviewer,reason};
   r.state=approved?'approved':'rejected';return snapshot(r);
  },
  list({state}={}){if(state&&!states.has(state))throw Error('Invalid state');return [...records.values()].filter(r=>!state||r.state===state).map(snapshot)},
  exportJSON(){return JSON.stringify({schema:'math-universe-adapter-registry/v1',records:[...records.values()].map(snapshot)})}
 });
}
