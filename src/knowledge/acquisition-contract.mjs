// LOCAL DRAFT: ABI pending A; no authority, persistence, or execution.
import { encodeMetadata, decodeMetadata } from '../math-universe-codec.mjs';
const reasons = new Set(['MISSING_MATHEMATICAL_PREREQUISITE']);
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function buildKnowledgeGap(input) {
  // Only object DTOs; never pass caller-owned byte views to the decoder.
  const r = decodeMetadata(encodeMetadata(input));
  if (r === null || Object.getPrototypeOf(r) !== null) throw Error('INVALID_FIELDS');
  if (Object.keys(r).sort().join(',') !== 'contextHash,methodId,reason') throw Error('INVALID_FIELDS');
  if (!hash(r.contextHash) || typeof r.methodId !== 'string' || !/^[a-zA-Z0-9._-]{1,128}$/.test(r.methodId) || !reasons.has(r.reason)) throw Error('INVALID_GAP');
  return Object.freeze({schema:'draft.knowledge-gap.v1',contextHash:r.contextHash,methodId:r.methodId,reason:r.reason,status:'ABSTAIN',verified:false,exportAuthorized:false,persistAuthorized:false,executable:false});
}
