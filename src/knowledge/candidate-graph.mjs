// Standalone candidate-only graph model. This module has no verification authority.
import { createHash, randomUUID } from 'node:crypto';
const kinds = new Set(['CONCEPT','DEFINITION','AXIOM','THEOREM','PROOF','EXPRESSION']);
const edges = new Set(['DEPENDS_ON','PROVES','DEFINES','REFERENCES','EXTRACTED_FROM','DERIVED_FROM','CONTRADICTS','EQUIVALENT_TO','SUPERSEDES']);
const hash = value => 'sha256:' + createHash('sha256').update(JSON.stringify(value)).digest('hex');
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
export function createCandidate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('candidate object required');
  if (own(input,'status') && input.status !== 'CANDIDATE') throw new Error('adapter cannot assign verification status');
  if (own(input,'verification') && input.verification != null) throw new Error('adapter cannot supply verification');
  if (!kinds.has(input.kind)) throw new Error('invalid kind');
  if (!input.statement || typeof input.statement !== 'object' || Array.isArray(input.statement) || typeof input.statement.format !== 'string' || !input.statement.format || typeof input.statement.content !== 'string' || !input.statement.content) throw new Error('invalid statement');
  const p=input.provenance;
  if (!p || typeof p !== 'object' || Array.isArray(p) || typeof p.source_id !== 'string' || !p.source_id || !/^sha256:[a-f0-9]{64}$/.test(p.source_hash) || !Number.isSafeInteger(p.page) || p.page < 1 || typeof p.extraction_method !== 'string' || !p.extraction_method) throw new Error('invalid provenance');
  const statement={format:input.statement.format,content:input.statement.content,context_hash:input.statement.context_hash ?? null};
  const provenance={source_id:p.source_id,source_hash:p.source_hash,page:p.page,extraction_method:p.extraction_method,adapter_version:p.adapter_version ?? null};
  const revision_id=hash({kind:input.kind,statement,provenance});
  return Object.freeze({schema_version:'kg.v1',entity_id:input.entity_id ?? randomUUID(),revision_id,kind:input.kind,statement:Object.freeze({...statement,content_hash:hash(statement)}),provenance:Object.freeze(provenance),status:'CANDIDATE',verification:null});
}
export function createEdge(input) {
  if (!input || !edges.has(input.type) || typeof input.from_revision !== 'string' || !input.from_revision || typeof input.to_revision !== 'string' || !input.to_revision) throw new Error('invalid graph edge');
  return Object.freeze({type:input.type,from_revision:input.from_revision,to_revision:input.to_revision,status:'CANDIDATE'});
}
