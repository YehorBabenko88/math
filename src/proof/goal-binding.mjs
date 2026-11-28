// DEV_CANDIDATE: provisional ABI; no integration or untrusted raw decoding.
// This pure seam never grants authority, writes records or runs a verifier.
import {types} from 'node:util';
const fields = Object.freeze(['theorem_revision','theorem_content_hash','typed_goal_hash','ordered_context_hash','source_manifest_hash','translation_evidence_hash','profile_hash','admission_policy_hash','verifier_build_hash','verification_policy_hash','request_id']);
const hex = /^[a-f0-9]{64}$/;
function valid(value) {
  if (value === null || typeof value !== 'object' || types.isProxy(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== null && proto !== Object.prototype) return false;
  if (Reflect.ownKeys(value).length !== fields.length) return false;
  return fields.every(k => {
    const d = Object.getOwnPropertyDescriptor(value,k);
    return d !== undefined && Object.hasOwn(d,'value') && d.enumerable && typeof d.value === 'string' && hex.test(d.value);
  });
}
/** Inputs must already be inert, decoded by A's strict codec. Expected binding
 * must originate from an independently admitted goal, not the claimant.
 * Equality is necessary, never sufficient for formal verification. */
export function compareProofBinding(expected, observed) {
  if (!valid(expected) || !valid(observed)) return Object.freeze({status:'REFUSED', reason:'INVALID_BINDING'});
  for (const field of fields) if (expected[field] !== observed[field]) return Object.freeze({status:'REFUSED', reason:'BINDING_MISMATCH', field});
  return Object.freeze({status:'BINDING_MATCH_ONLY', formalProof:false});
}
