# PR56 confidential local receiver implementation plan

Base920fd4977192bdd29606cb58d193fc7998a1c862. User chose local computer receiver; no ingress, firewall/system changes or real key provisioning authorized. Implement offline sealed-courier library with memory-only plaintext, external recipient RSA-OAEP key and separate reviewer Ed25519 key, GitHub RS256 OIDC and signed check_run_id to authoritative job API binding. Durable local SQLite challenge/replay/encrypted bundle store uses isolated temporary databases in tests only. No workflow transport enabled until separately accepted delivery/key policy.

1. Complete read-only queued-run inventory; propose but never execute cancellations.
2. Add RED crypto/OIDC/nonce/replay/source/run/attempt/job tests, strict parser, provider-only trust adapters.
3. Implement bounded STORE ZIP verifier and exact private bundle inventory/SHA256/source/native schema verification; no extraction/commands.
4. Persist nonce consumption, replay fingerprint and sealed bundle atomically. Signed allowlisted receipt explicitly denies physical/production and marks independent deployment unqualified.
5. Add deterministic actual-source bootstrap120s and PowerShell150s fake-kernel tests; real expiry stays BLOCKED.
6. Run approved bounded pure/static/model Node22/24 and PS5.1 compile-only checks, independent review, evidence hashes, isolated commit/Draft PR. Preserve original branches and logs; no reruns or system/physical actions.

Real GitHub token interoperability, external policy/key custody, confidential delivery and private independent operator acceptance remain blockers. Synthetic keys are ephemeral fixtures only, not trust anchors. No automatic Execute/G1/Book/production approval.
