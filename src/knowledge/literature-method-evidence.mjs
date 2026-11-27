import {types} from 'node:util';

// Accept DTOs from the shared A decoder; this is not a decoder or authority.
const fail = () => { throw new TypeError('INVALID_SCHEMA'); };
function closed(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)) fail();
  const proto = Object.getPrototypeOf(value);
  if (proto !== null && proto !== Object.prototype) fail();
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length) fail();
  const out = Object.create(null);
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !d.enumerable || !Object.hasOwn(d, 'value')) fail();
    out[key] = d.value;
  }
  return out;
}
const ref = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const rightsValues = new Set(['ALLOWED', 'DENIED', 'UNKNOWN']);
const outcomes = new Set(['SUPPORTED', 'CONTRADICTED', 'INCONCLUSIVE', 'NOT_APPLICABLE', 'INSUFFICIENT_DATA', 'RETRACTED']);
export function assessLiteraturePrerequisites(input) {
  const v = closed(input, ['schema', 'sourceRef', 'methodRef', 'rights', 'reviewRef', 'outcome']);
  if (v.schema !== 'math.literature.prerequisites.v1' || !ref(v.sourceRef) || !ref(v.methodRef) ||
      !(v.reviewRef === null || ref(v.reviewRef)) || !outcomes.has(v.outcome)) fail();
  const rights = closed(v.rights, ['TEXT', 'DATA', 'CODE']);
  const reasons = ['SOURCE_UNVERIFIED', 'METHOD_UNVERIFIED', 'EXPORT_NOT_AUTHORIZED'];
  for (const kind of ['TEXT', 'DATA', 'CODE']) {
    if (!rightsValues.has(rights[kind])) fail();
    if (rights[kind] !== 'ALLOWED') reasons.push('RIGHTS_' + kind + '_' + rights[kind]);
  }
  reasons.push(v.reviewRef === null ? 'REVIEW_MISSING' : 'REVIEW_UNVERIFIED');
  reasons.push('OUTCOME_' + v.outcome);
  if (v.outcome === 'RETRACTED') reasons.push('ELIGIBILITY_BLOCKED');
  return Object.freeze({status:'UNVERIFIED', reasons:Object.freeze(reasons),
    formalProof:false, execution_authority:false});
}
