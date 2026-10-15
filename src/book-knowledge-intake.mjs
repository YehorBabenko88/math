// Deterministic, bounded intake queue for human-reviewed scientific references.
// This module does not execute Codex, download books, or claim mathematical proof.
const stages=new Set(['queued','extracted','review_required','approved','rejected']);
function bounded(s,label,max=2000){if(typeof s!=='string'||!s.trim()||s.length>max)throw Error('Invalid '+label);return s.trim()}
export function createBookKnowledgeIntake(){
 const records=new Map();
 return Object.freeze({
  add({id,sourceTitle,sourceLocator,sourceHash,license,excerpt,concepts=[]}){
   id=bounded(id,'id',128);if(records.has(id))throw Error('Duplicate record');
   if(!Array.isArray(concepts)||concepts.length>32)throw Error('Invalid concepts');
   const record={id,sourceTitle:bounded(sourceTitle,'title'),sourceLocator:bounded(sourceLocator,'locator'),sourceHash:bounded(sourceHash,'hash',128),license:bounded(license,'license',256),excerpt:bounded(excerpt,'excerpt',2000),concepts:concepts.map(x=>bounded(x,'concept',128)),stage:'queued',reviewer:null,reviewNote:null};
   records.set(id,record);return structuredClone(record);
  },
  transition(id,stage,{reviewer,note}={}){
   const r=records.get(id);if(!r)throw Error('Unknown record');
   if(!stages.has(stage))throw Error('Unknown stage');
   const allowed={queued:['extracted','rejected'],extracted:['review_required','rejected'],review_required:['approved','rejected'],approved:[],rejected:[]};
   if(!allowed[r.stage].includes(stage))throw Error('Invalid stage transition');
   if(stage==='approved'||stage==='rejected'){r.reviewer=bounded(reviewer,'reviewer',128);r.reviewNote=bounded(note,'review note',1000)}
   r.stage=stage;return structuredClone(r);
  },
  list({stage}={}){if(stage&&!stages.has(stage))throw Error('Unknown stage');return [...records.values()].filter(r=>!stage||r.stage===stage).map(structuredClone)},
  exportJSON(){return JSON.stringify({schema:'math-universe-book-intake/v1',records:[...records.values()]})}
 });
}
