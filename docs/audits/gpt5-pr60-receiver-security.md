# GPT-5 independent confidential receiver audit — PR60

Candidate HEAD: `b24d2d6ca264926c1a65a96f574057192bfeca03`. Exact tree not independently resolved in this pass. Original PR60 remains unchanged.

## Proven finding and fix
`verifyReceiverReceipt` checked Ed25519 signature and closed-gate status fields but did not reject extra signed receipt fields. A synthetically signed receipt could contain `verified: true`, `Execute: true` or `ownerApproved: true` while retaining all mandatory blocked statuses; the verifier returned that object. Added exact receipt field allowlist and regression with correctly signed synthetic altered receipts. This is trust-envelope ambiguity, not a demonstrated signature forgery or actual execution bypass. Never promote receipt to VERIFIED.

## Reviewed security boundaries
- Direct and PR merge: `verifySourceBinding` distinguishes source merge SHA from REST run/job PR-head SHA; requires exact base and ordered merge parents, source tree and sole PR association. Source-shape tests use captured immutable graph; live OIDC claim interoperability is NOT demonstrated.
- JWT: RS256 JWK, issuer/audience/subject/repository/workflow SHA, nonce, iat/nbf/exp, run/attempt/job/check_run_id; provider JSON bounded and fixed origin.
- Journal: SQLite UNIQUE nonce, token SHA256 and JTI SHA256 with BEGIN IMMEDIATE and monotonic clock. First-open concurrency, crash/fault injection and filesystem adversary acceptance remain unresolved (Q01 OPEN).
- Courier: RSA-OAEP-SHA256 + AES-256-GCM with recipient key ID AAD; Ed25519 receipt signing. Real key custody, rotation, revocation, trusted JWKS/collector enrollment not deployed or accepted.
- ZIP: STORE-only parser with exact inventory, central/local consistency, SHA256, CRC and bounded sizes; no extraction. Independent fuzz/adversarial corpus and memory profiling remain pending.
- Receiver status remains STORED_PENDING_INDEPENDENT_REVIEW, physicalG1 BLOCKED, production NO_GO, bookGate CLOSED, receiverDeployment UNQUALIFIED.

## Exact-head CI snapshot
Candidate PR60: Book Ingestion, Validate Math Universe, Windows Deployment, Confidential Evidence Receiver, Q01 Queue Reliability, Browser E2E, Q01 Windows Containment all SUCCESS. PostgreSQL Integration FAILURE in all four Node22/24 x PG16/18 matrix jobs, with failure at full unfiltered suite. This is not a receiver-specific FAIL without log attribution; full integrated acceptance NO-GO.

## Codex handoff
P0: retain strict closed receipt projection and trusted key custody; do not grant Execute/VERIFIED/production. Add independent enrollment, key rotation/revocation policy and immutable public-key trust anchors.
P1: run new synthetic signed-extra-field negatives on exact HEAD, investigate PG matrix failures separately, test journal first-open/crash recovery, verify source graph with provider fixtures and JWT semantics.
P1: adversarial ZIP corpus and bounded memory acceptance, replay across process restarts.
P2: operational telemetry, receipt versioning and independent evidence retention.
EXECUTED: GitHub PR, source and CI metadata inspection, separate Draft code/test changes.
NOT_RUN: new exact-head CI, local Node matrix, live OIDC, real secrets/transport, physical/production.
Decision: NO-GO. Q01 OPEN. No merge/deployment/production operations.
