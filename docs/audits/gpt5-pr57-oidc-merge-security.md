# GPT-5 independent PR57 OIDC and courier audit

Base exact HEAD: `d18a95d2a0936c35d1c0d74febeb4b05d25f4366`.
Base tree: `2f598f6ead0707bbcc626b9800876514bc9b645b` (as reported by independent Git API review comment; not independently re-resolved in this audit).

## Confirmed PR-merge relationship defect
Original `verifyWorkload` required `run.head_sha == challenge.runHead`, `commit.sha == challenge.sourceHead` and `commit.parents[1].sha == challenge.runHead`. For synthetic pull_request merge, run.head_sha is the merge commit, and parents[1] is the PR head, not that merge commit. This makes normal PR merge fixtures impossible. Fixed by requiring sourceHead == runHead == fetched merge commit SHA, exactly one API pull_request entry, parent[0] == baseHead, parent[1] == API PR head, and PR head distinct from merge. No acceptance of arbitrary parents. Added synthetic negative tests for substituted parent and PR head.

## Additional read-only observations
- OIDC: RS256 with 2048–4096-bit JWK, strict alg/typ/kid, signed GitHub claims, challenge nonce, bounded time, check_run_id, run/attempt/job and exact source tree. Provider adapter fixed-origin HTTPS and no redirects. Independent JWKS custody and production enrollment not established.
- Replay: SQLite journal UNIQUE nonce/token/jti plus BEGIN IMMEDIATE and monotonic logical clock. Cross-process crash/first-open, filesystem identity and operational replay acceptance remain unverified.
- Courier: RSA-OAEP-SHA256 wraps 32-byte AES-256-GCM key, random 12-byte IV, recipient key ID in AAD; Ed25519 receipt signature uses distinct key. These are sound primitives; deployment key custody, rotation, revocation and trusted recipient enrollment are NOT established.
- ZIP: strict STORE-only parser with central/local matching, CRC, SHA256, bounded names and bytes, exact inventory, no extraction in verifier. Real adversarial archive matrix and parser edge cases need independent tests.
- Receipt: signature attests bytes as signed by enrolled key, not mathematical truth, native isolation, G1 or publication. Output remains STORED_PENDING_INDEPENDENT_REVIEW / UNQUALIFIED.

## Gates and test ledger
P0: trusted key custody, JWKS provenance, no auto VERIFIED/Execute, no production/physical acceptance.
P1: PR merge relationship fix (patched); exact-head Node22/24 and hosted CI needed. Independent ZIP/nonce race tests and GitHub provider fixtures still needed.
P2: key rotation and operational auditing, crash fault injection.
EXECUTED: GitHub PR/comment/source review and isolated Draft changes.
TESTS AUTHORED: synthetic merge-parent substitution and PR-head substitution.
NOT_RUN: independent local test runner, hosted exact-head CI results, real keys/collector, ADMINIT/physical.
Q01 OPEN, Physical G1 BLOCKED, Production NO-GO.
