// Standalone candidate-only graph model. This module has no verification authority.
import { createHash, randomUUID } from 'node:crypto';
import { types } from 'node:util';
// Snapshot each schema record before validating or retaining any of its fields.
// Inspect descriptors rather than reading accessors supplied by an adapter.
function dataRecord(value) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('invalid data record');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  const entries=Reflect.ownKeys(descriptors).map(key=>{
    const descriptor=descriptors[key];
    if(typeof key!=='string' || !descriptor.enumerable || !Object.hasOwn(descriptor,'value')) throw new Error('invalid data record');
    return [key,descriptor.value];
  });
  return Object.fromEntries(entries);
}
const kinds = new Set(['CONCEPT','DEFINITION','AXIOM','THEOREM','PROOF','EXPRESSION']);
const edges = new Set(['DEPENDS_ON','PROVES','DEFINES','REFERENCES','EXTRACTED_FROM','DERIVED_FROM','CONTRADICTS','EQUIVALENT_TO','SUPERSEDES']);
const canonical = value => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  throw new TypeError('non-canonical value');
};
const hash = value => 'sha256:' + createHash('sha256').update(canonical(value)).digest('hex');
const keysOnly = (obj, allowed) => {
  if (Object.getPrototypeOf(obj) !== Object.prototype || Object.keys(obj).some(k => !allowed.includes(k))) throw new Error('unexpected field');
};
const nonempty = x => typeof x === 'string' && x.length > 0 && x.length <= 65536;
const digest = x => typeof x === 'string' && /^sha256:[a-f0-9]{64}$/.test(x);
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
export function createCandidate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('candidate object required');
  input=dataRecord(input);
  keysOnly(input,['kind','statement','provenance','entity_id','status','verification']);
  if (own(input,'status') && input.status !== 'CANDIDATE') throw new Error('adapter cannot assign verification status');
  if (own(input,'verification') && input.verification != null) throw new Error('adapter cannot supply verification');
  if (!kinds.has(input.kind)) throw new Error('invalid kind');
  input.statement=dataRecord(input.statement);
  keysOnly(input.statement,['format','content','context_hash']);
  if (!nonempty(input.statement.format) || !nonempty(input.statement.content) || (input.statement.context_hash != null && !digest(input.statement.context_hash))) throw new Error('invalid statement');
  if (input.entity_id !== undefined && !nonempty(input.entity_id)) throw new Error('invalid entity_id');
  const p=dataRecord(input.provenance);
  keysOnly(p,['source_id','source_hash','page','extraction_method','adapter_version']);
  if (!nonempty(p.source_id) || !digest(p.source_hash) || !Number.isSafeInteger(p.page) || p.page < 1 || !nonempty(p.extraction_method) || (p.adapter_version != null && !nonempty(p.adapter_version))) throw new Error('invalid provenance');
  const statement={format:input.statement.format,content:input.statement.content,context_hash:input.statement.context_hash ?? null};
  const provenance={source_id:p.source_id,source_hash:p.source_hash,page:p.page,extraction_method:p.extraction_method,adapter_version:p.adapter_version ?? null};
  const revision_id=hash({kind:input.kind,statement,provenance});
  return Object.freeze({schema_version:'kg.v1',entity_id:input.entity_id ?? randomUUID(),revision_id,kind:input.kind,statement:Object.freeze({...statement,content_hash:hash(statement)}),provenance:Object.freeze(provenance),status:'CANDIDATE',verification:null});
}
export function createEdge(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid graph edge');
  input=dataRecord(input);
  keysOnly(input,['type','from_revision','to_revision']);
  if (!edges.has(input.type) || typeof input.from_revision !== 'string' || !input.from_revision || typeof input.to_revision !== 'string' || !input.to_revision) throw new Error('invalid graph edge');
  return Object.freeze({type:input.type,from_revision:input.from_revision,to_revision:input.to_revision,status:'CANDIDATE'});
}
