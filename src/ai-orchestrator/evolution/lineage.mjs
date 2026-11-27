// Compare already decoded semantic references; never grant authority.
const DENIED = Object.freeze({status:'DENIED', execution_authority:false});
const MATCH = Object.freeze({status:'BINDING_MATCH_ONLY', execution_authority:false});
const id = x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
export function checkLineage(parent, base, rollback, candidate) {
  if (![parent,base,rollback,candidate].every(id)) return DENIED;
  return parent === base && rollback === base && candidate !== base ? MATCH : DENIED;
}
