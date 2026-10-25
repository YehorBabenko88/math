# Focused v2 pending-state fix

Base cb168925b5aeec0c957137dd94ab72c64f0bd333; branch fix/pr31-verifier-pending-state; pushed commit ab8b8099189e599ed61c7e7891c66e3585cc0fbd; tree87e4a599f682f0efb09f3cd41b5ce72c7d0bb263.

Confirmed defect: a valid signed v2 result could be assessed for an otherwise identical request whose requested_status was VERIFIED or another non-PENDING value. The verifier authenticated the envelope and consumed the one-shot nonce even though the request state violated the builder's PENDING contract. It never promoted graph status.

Minimal fix: add requested_status === PENDING to existing request-validation guard before signature assessment reaches FileReplayLedger.consume. No imports, store changes, constructor hardening, extra-field policy, or other PR32 changes.

Regression written first: non-PENDING values VERIFIED, REJECTED, null, undefined must reject with invalid request; then original PENDING request with the same signed result succeeds as AUTHENTICATED_RESULT_ONLY; a second use rejects replay. RED observed on unmodified production source: Missing expected rejection,3PASS/1FAIL/0SKIP,Node24.20.0. See pending-state-red-node24.log.

GREEN: eight relevant pure test files (candidate/store, verification-request, kernel-result/authenticator, one-shot/persisted-verifier/file-replay-ledger):41PASS/0FAIL/0SKIP under Node24.20.0 and22.23.3. See pending-state-green-node24.log and pending-state-green-node22.log. git diff --check passed. No queue/native containment/livePG/physical/deployment execution. Q01 OPEN; production NO-GO.

Only two committed files: src/knowledge/one-shot-verifier.mjs; tests/knowledge-one-shot-verifier.test.mjs. Evidence logs/report remain untracked outputs. No PR created, pending root review. Existing PRs and integration/main unchanged. Native managed-worktree tool returned Not a git repository; authorized explicit git worktree fallback created sibling pr31-verifier-pending-state from exact base.
