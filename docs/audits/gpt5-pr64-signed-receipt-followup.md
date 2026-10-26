# GPT-5 — PR64 independent receiver security follow-up

Candidate PR64 exact HEAD `9094a68fe723e6618e6726f97d8a7df67a76d790`; reported tree `6deee700d374a821cf09b4a4ed0eeb915f965e1f` (not independently re-resolved by Git objects in this pass). PR62 exact HEAD `b84a818f254fbf9a482406213bd56395aa4c5db0`, separate unmerged audit.

## Confirmed defects
PR64 still uses the original `verifyReceiverReceipt` which accepts extra correctly signed trust/Execute fields and does not pin schema, attestationScope, nativeAcceptance or q01. The stricter PR62 fix is not integrated into PR64. This is a trust-envelope ambiguity, not a cryptographic forgery. Patched exact allowlist and closed values.

New PR64 synthetic `verifySyntheticReceipt` has the same issue: valid signature and a subset of closed fields suffice, allowing additional signed `verified` / `ownerApproved` / `Execute` fields and changed `q01` / `bookGate` while passing. Patched exact schema and closed values.

Added synthetic tests that sign mutated receipts with ephemeral Ed25519 keys and require BLOCKED. No real secrets or transport.

## Other reviewed boundaries
- OIDC PR-merge source graph: synthetic merge source SHA distinct from REST PR head, ordered base/head parents, immutable source tree, run/attempt/job/check-run and pinned collector job workflow SHA are checked in source. Live hosted source/OIDC interoperability is not independently accepted.
- Journal: nonce/JTI/token uniqueness and BEGIN IMMEDIATE are present; Q01 OPEN, crash/fault-injection and hostile filesystem acceptance incomplete.
- Courier: RSA-OAEP-SHA256, AES-256-GCM and Ed25519 are used; ephemeral hosted key pairs do not establish trusted operational key custody, rotation or revocation.
- ZIP: STORE-only parser and SHA256/inventory/bounds; independent adversarial ZIP and memory acceptance incomplete.
- PR64 synthetic transport auth step reported failure; do not reinterpret as qualification PASS.

## Security acceptance matrix
P0 FAIL (candidate): strict signed receipt schema and trust escalation; patch authored in separate Draft.
P0 BLOCKED: trusted operational key custody and independent reviewer enrollment.
P1 PASS static: nonce/JTI transaction design, cryptographic primitive selection, ZIP parser controls.
P1 BLOCKED: crash recovery, independent real OIDC run binding, ZIP fuzz/limits, exact-head hosted verification.
P2: rotation/revocation, independent operator acceptance, safe diagnostic projection.

Executed: GitHub PR/source inspection, targeted negative test authorship and separate Draft code patches.
Not run: local Node22/24 execution, new exact-head CI, physical ADMINIT, production DB, real OIDC/keys/transport.
No merge, deployment, production, physical action or cancellations.
Q01 OPEN; Physical G1 BLOCKED; Production NO-GO; Book gate CLOSED.

## Codex handoff
Integrate only after independently reviewing this Draft against exact PR64 tree. Run focused `node --test tests/evidence-receiver.test.mjs tests/confidential-synthetic-session.test.mjs` on Node22/24, then full authorized hosted CI. Never treat a signed receipt as VERIFIED/Execute or override closed status. Preserve provenance and privacy constraints.
