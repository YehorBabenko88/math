// Read-only request builder: this module cannot verify proofs or change statuses.
const digest = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
export function buildVerificationRequest(graph, theoremRevision, proofRevision, contextHash) {
 if (!digest(theoremRevision) || !digest(proofRevision) || !digest(contextHash)) throw Error('invalid verification digest');
 const theorem=graph.getRevision(theoremRevision);
 const proof=graph.getRevision(proofRevision);
 if (!theorem || !proof || theorem.kind!=='THEOREM' || proof.kind!=='PROOF') throw Error('invalid verification targets');
 if (theorem.status!=='CANDIDATE' || proof.status!=='CANDIDATE') throw Error('unexpected verification state');
 if (theorem.statement.context_hash!==contextHash || proof.statement.context_hash!==contextHash) throw Error('context mismatch');
 return Object.freeze({
  schema_version:'kg.verify-request.v1',
  theorem_revision:theoremRevision,
  theorem_content_hash:theorem.statement.content_hash,
  proof_revision:proofRevision,
  proof_content_hash:proof.statement.content_hash,
  context_hash:contextHash,
  requested_status:'PENDING',
 });
}
