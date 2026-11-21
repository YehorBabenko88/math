import {verifyCandidate} from './candidate.mjs';
import {safeJson,freezeJson} from './json.mjs';
const FIELDS=['candidateDigest','decision','reviewer','reason','reviewedAt','visualVerified'];
function strict(input,fields){const value=safeJson(input,{maxBytes:8192});if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||fields.some(k=>!Object.hasOwn(value,k)))throw Error('Invalid review decision schema');return value}
function checkedReceipt(input){
 const r=strict(input,FIELDS);
 if(typeof r.candidateDigest!=='string'||!(/^[a-f0-9]{64}$/).test(r.candidateDigest)||!['approved','rejected'].includes(r.decision)||typeof r.visualVerified!=='boolean')throw Error('Invalid review decision');
 for(const key of ['reviewer','reason'])if(typeof r[key]!=='string'||!r[key].trim()||r[key].length>(key==='reviewer'?200:1000)||/[\u0000-\u001f\u007f]/.test(r[key]))throw Error('Invalid human review text');
 if(typeof r.reviewedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.reviewedAt)||!Number.isFinite(Date.parse(r.reviewedAt))||new Date(r.reviewedAt).toISOString()!==r.reviewedAt)throw Error('Invalid review timestamp');
 return r;
}
export function validateReviewDecision(candidate,receipt,context={}){
 const r=checkedReceipt(receipt),verified=verifyCandidate(candidate,context);
 if(r.candidateDigest!==verified.digest)throw Error('Review candidate digest mismatch');
 if(r.decision==='approved'){
  if(verified.report.status!=='valid')throw Error('Successful numeric verification required for approval');
  if(verified.report.requiresVisualReview&&!r.visualVerified)throw Error('Explicit visual verification required for approval');
 }
 return freezeJson(r);
}
export function createReviewDecision(candidate,fields,context={}){
 const input=strict(fields,FIELDS.filter(k=>k!=='candidateDigest'));
 const {digest}=verifyCandidate(candidate,context);
 return validateReviewDecision(candidate,{candidateDigest:digest,...input},context);
}
