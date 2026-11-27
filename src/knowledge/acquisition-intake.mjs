// LOCAL DRAFT: inert metadata only; original bytes are not retained or exported.
import { encodeMetadata, decodeMetadata } from '../math-universe-codec.mjs';
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function quarantineHandoff(input) {
  // Only object DTOs; never pass caller-owned byte views to the decoder.
  const r = decodeMetadata(encodeMetadata(input));
  if (r === null || Object.getPrototypeOf(r) !== null) throw Error('INVALID_FIELDS');
  if (Object.keys(r).sort().join(',') !== 'artifactHash,contextHash,origin') throw Error('INVALID_FIELDS');
  if (!hash(r.artifactHash) || !hash(r.contextHash) || !['HUMAN','CHATGPT'].includes(r.origin)) throw Error('INVALID_HANDOFF');
  return Object.freeze({schema:'draft.quarantine-handoff.v1',artifactHash:r.artifactHash,contextHash:r.contextHash,originClaim:r.origin,status:'QUARANTINED',rights:'UNKNOWN',verified:false,exportAuthorized:false,persistAuthorized:false,executable:false});
}
