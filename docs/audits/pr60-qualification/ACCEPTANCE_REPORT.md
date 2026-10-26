# PR60 operational confidential qualification

Date: 2026-10-26. Control PR60 remains b24d2d6ca264926c1a65a96f574057192bfeca03 (tree 2d9779913c4a0e127629e55debf53d3e53a9892b).

## Decision

GO only to the first disposable hosted synthetic transport experiment. Operational confidential acceptance BLOCKED. This document does not qualify native evidence or authorize a physical run. Q01 OPEN; Physical G1 BLOCKED; Production NO-GO; Book gate CLOSED.

## Implementation and trust boundaries

Immutable collector snapshot: fa9508b00d285c58a435b37a0a581f0f84b486b3 (tree 054bac9586291d7f7110e27abe77b07463c2e5a4). The caller pins this exact commit twice. Final candidate HEAD is the commit containing this report; resolve it with `git rev-parse HEAD` rather than treating a self-referential report as an attestation.

The reusable workflow does not checkout or execute candidate code. Its fixed loader verifies twelve regular Git blobs against SHA-256 literals before execution. A Worker independently reads REST source/run/attempt/job identities and verifies the real signed issuer token against official JWKS. Existing strict temporal, audience, source binding and crypto constraints remain enforced. Immutable synthetic merge parents and REST head are distinct identities. Public receipt projection retains merge, tree, REST head, base and workflow identities separately.

Synthetic recipient RSA and receipt Ed25519 keys are distinct, ephemeral and Worker-owned; no key files or secrets enter Git. This is process separation on one host, not an independent operational trust domain. See KEY_CUSTODY_PLAN.md for independent local custodian enrollment, anti-rollback storage and remaining provisioning blockers. A local operational receiver has NOT been deployed or accepted.

Only sealed synthetic data crosses the MessagePort. Private journal and plaintext are removed before success. Public JSON is allowlisted and contains no raw token, private key, synthetic canary or encrypted bundle. stdout/stderr permit only fixed sentinels; worker output blocks qualification. Hosted infrastructure logs require independent review and cannot be certified from source alone.

## RED/GREEN evidence

New regressions reproduced absent collector authentication/session/publication barriers, unchecked loader/source identities and missing caller pinning before implementation. Detailed TAP remains private in outputs; it is not uploaded as raw evidence. Nine synthetic rejection cases cover replay, source, run, attempt, job, check-run, unsigned receipt, wrong signing key and corrupted ZIP. A valid baseline is verified before and after negative cases to prevent expiry from manufacturing a false rejection PASS.

Final explicitly enumerated safe receiver/collector suite:

| Environment | PASS | FAIL | SKIP | Scope |
|---|---:|---:|---:|---|
| Local Node 22.23.3 |127|0|0|Pure receiver/collector contracts only|
| Local Node 24.20.0 |127|0|0|Same 18 files; no native/Q01/PG/full suite|
| Hosted Linux/Windows Node22/24 |NOT_RUN|NOT_RUN|NOT_RUN|Await first PR event|
| Hosted real issuer transport |BLOCKED|—|—|Await immutable reusable workflow run|
| Native/ADMINIT/Q01/production |NOT_RUN|—|—|Explicitly prohibited|

SHA-256 private evidence references:

- final-node22.tap: 70c4a87f2ab419546d33a4bfa9978d323da3ff322439f4f9752477ba2162f119
- final-node24.tap: 462a17d3de5389f6c3692361a4521cb0efc5cdeea0929ad075018f2468ff6850
- caller-red.tap: 4e662b6ae47683610d5f55b8a2b9a52dde767ec3d6614480bf64a4ae65a509aa
- caller-green.tap: a1c245e5bda796f7e51170b31313439cabd3c799f02fb1fe4a0b8050bea3bcfc

`git diff --check` and current tracked-document publication policy passed. That policy does not inspect runtime logs or erase Git history. Independent static review found no concrete new P1/P2 blocker under the pinned synthetic-only model; live issuer compatibility remains unproven.

## CI scope and privacy findings

Twenty unrelated workflow jobs explicitly exclude this feature branch to honor the prohibition on native, Q01, PG and full-suite execution. Such skipped jobs are NOT acceptance PASS; no project-wide CI readiness is asserted. The only intended executions are scoped receiver contracts and one synthetic qualification job. Other branches retain their prior behavior. No reruns, cancellations or dispatch were requested.

See PR60_LOG_PRIVACY_REVIEW.md: the original four successful receiver jobs had real Node PID warnings and infrastructure account paths in logs, despite having zero artifacts. New scoped jobs suppress Node warning identifiers and the collector never forwards child output. This does not erase earlier logs or Git history, and does not guarantee privacy of GitHub-controlled setup/cleanup output.

## Remaining blockers and required next evidence

- First real signed GitHub issuer claims must pass unchanged strict authorization. Signature-only observations are diagnostic, never authorization. Temporal/claim-shape failures remain BLOCKED until justified independently; do not weaken checks merely to pass.
- Verify current-attempt job inventory, single job identity, source merge parents/tree, reusable workflow SHA and one exact public artifact ZIP after completion. No fallback to stale success.
- Independently review all new run logs and artifact inventory. No raw bundle is publicly uploaded; ephemeral synthetic evidence is not recoverable for later native acceptance.
- Operational key custody, isolated receiver trust and protected private delivery/archive are not established by this synthetic Worker experiment.
- No ADMINIT isolation evidence or Execute approval has been accepted.

The first hosted result and exact run/job IDs must be reported as observed; queued/skipped/missing evidence must remain distinct from PASS.
