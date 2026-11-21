// Provenance-only references. No remote content is executed or trusted as instructions.
const ID=/^\d{4}\.\d{4,5}(?:v[1-9]\d*)?$/;
export function normalizeResearchReference(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid research reference');
 const {arxivId,title,authors=[],retrievedAt,source='alphaXiv'}=input;
 if(typeof arxivId!=='string'||!ID.test(arxivId))throw Error('Invalid arXiv identifier');
 if(typeof title!=='string'||!title.trim()||title.length>500)throw Error('Invalid paper title');
 if(!Array.isArray(authors)||authors.length>100||authors.some(a=>typeof a!=='string'||!a.trim()||a.length>200))throw Error('Invalid authors');
 if(typeof retrievedAt!=='string'||!Number.isFinite(Date.parse(retrievedAt)))throw Error('Invalid retrieval timestamp');
 if(source!=='alphaXiv'&&source!=='arXiv')throw Error('Unsupported research source');
 const base=arxivId.replace(/v\d+$/,'');
 return Object.freeze({arxivId,title:title.trim(),authors:[...authors],retrievedAt:new Date(retrievedAt).toISOString(),source,canonicalUrl:'https://arxiv.org/abs/'+encodeURIComponent(arxivId),alphaXivUrl:'https://alphaxiv.org/abs/'+encodeURIComponent(arxivId),baseId:base,version:arxivId.match(/v(\d+)$/)?.[1]??null,verification:'unverified'});
}
export function createResearchLibrary(){
 const references=new Map();
 return {
  add(reference){const normalized=normalizeResearchReference(reference);references.set(normalized.arxivId,normalized);return normalized},
  get(id){return references.get(id)??null},
  list(){return [...references.values()]},
  exportJSON(){return JSON.stringify({schemaVersion:1,references:[...references.values()]})}
 };
}
export function importResearchLibrary(document){
 const data=typeof document==='string'?JSON.parse(document):document;
 if(!data||data.schemaVersion!==1||!Array.isArray(data.references)||data.references.length>1000)throw Error('Invalid research library');
 const library=createResearchLibrary();
 for(const reference of data.references)library.add(reference);
 return library;
}
