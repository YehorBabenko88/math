# Local confidential receiver — protocol v1 and qualification boundary

Implementation is a Node22/24 library under `src/evidence-receiver/`; it is not deployed or automatically connected to Actions. User chose the local computer. No listener/port, firewall/ACL/UAC/ExecutionPolicy changes, production keys or credential extraction are performed. All test keys are ephemeral RAM fixtures. Existing owner/PowerShell/Execute guards are unchanged. A receiver import never executes ZIP members.

## Implemented path

1. Independently reviewed local receiver code is staged outside the untrusted candidate. An external operator supplies trusted policy, RSA recipient KeyObject (3072/4096), separate Ed25519 reviewer-signing KeyObject, and a private journal path OUTSIDE any Git checkout. There is deliberately no secret loader, auto-provisioner, localhost HTTP endpoint or environment-based approval. Key custody and Windows effective ACL qualification remain external prerequisites.
2. Operator issues a durable 120-second challenge pinned to repository/owner IDs, exact subject, workflow ref+SHA, event, source head/tree, REST run head, approved PR base/head relation, run/attempt/job/check-run IDs and independently approved package manifest/executable digests. Expected package pins must NOT merely be copied from an untrusted sender.
3. Trusted collector would request GitHub OIDC with audience `urn:math-universe:evidence:<nonce>`, create the exact STORE bundle below and call `seal` with an independently distributed receiver public key. RSA-OAEP-SHA256 wraps random AES256-GCM key; authenticated envelope binds protocol version/key fingerprint. OIDC bearer and raw evidence exist only INSIDE ciphertext. No collector permission or upload path is enabled here.
4. Local receiver checks expected envelope digest from independent transfer metadata, decrypts in memory, verifies bounded strict JWT JSON, RS256 against fixed GitHub HTTPS JWKS (never a sender jku), exact issuer/audience/subject/repository IDs/workflow SHA/event/hosted runner/source/run/attempt/check_run_id and bounded timestamps. JWT lifetime can exceed challenge lifetime; effective validity is their minimum. No clock-skew relaxation grants access.
5. Separate fixed-origin GitHub API reads verify run attempt, exact job membership in that attempt, check_run_url to signed check_run_id, source commit tree and source relation. For PR merges, commit parents must be exact approved base/head and match API PR metadata. Direct mode requires source=run head. No implicit head/merge equivalence. Response bound1MiB,5s, no redirects/remote URLs; >100 jobs fails closed pending explicit pagination support.
6. Actual ZIP bytes are checked before any JSON/package interpretation: whole SHA256, STORE-only, exact fixed names, matching central/local headers, CRC, contiguous byte accounting, no links/extra fields/comments/encryption/descriptors/zip64/traversal/aliases, <=16 entries/32MiB outer bound and8MiB receiver protocol bound. Unsupported ZIP features are refused. There is no archive extraction or arbitrary command execution.
7. Every manifest file/hash/size, external package pins, source/workflow identity, five-case/owner-watchdog schema, bootstrap120s and PowerShell150s proof inventories are checked. `evidenceSource=HOSTED_NATIVE` is still a producer claim, not independent proof of measurement. Actual runtime qualification requires human independent review and a trusted collector.
8. Encrypted original envelope and separately encrypted receiver-observed API/JWKS capture are stored atomically with nonce/token/JTI consumption. SQLite uses BEGIN IMMEDIATE and uniqueness constraints; unknown schema/application ID/version fails closed. Failed/expired/replayed requests do not mark the challenge accepted. Tests cover competing connections, rollback, restart and duplicate JTI. This is receiver state, never Book/Q01 queue or PostgreSQL.
9. Separate Ed25519 key signs an allowlisted projection: status STORED_PENDING_INDEPENDENT_REVIEW, scoped workload/bundle integrity, provider-capture digest and source/run/attempt/job IDs. No raw SID/PID/ACL/token/opaque payload is copied. Signer key must be pinned independently. The verifier rejects foreign keys, modified receipt and any attempted PASS/G1/production promotion. Receiver deployment remains UNQUALIFIED; this signature does not self-approve it.

## Exact STORE inventory

- `manifest.json` (six records, all other files in sorted order; no self-hash)
- `bootstrap/result.json`
- `native/results.json`
- `package/AdminitSyntheticHarness.exe`
- `package/package.json`
- `powershell/result.json`
- `source/identity.json`

Bundle v1 accepts only this new fixed protocol, not arbitrary legacy raw directories. It requires actual structured bootstrap/PowerShell descendant-drain witnesses; current historical five-case/digest-only artifacts cannot satisfy that requirement and MUST NOT be backfilled with model output. Bootstrap and PowerShell fake-kernel tests prove code/model branches only, never NATIVE_MEASURED evidence.

## Trust still missing / deployment NO-GO

No real GitHub OIDC token interoperability or confidential hosted-to-local delivery has been qualified. No production private keys, approved receiver public-key distribution, independent reviewer/key-custodian identity, protected Windows storage or trusted collector workflow pin are configured. No id-token permission was added to existing workflows. Offline sealed courier is the intended local approach; its actual transfer and approved digest source require independent acceptance. Public ciphertext routing, if chosen later, requires separate reviewed policy and must never include plaintext/bearer metadata.

Different cryptographic keys do not by themselves prove role independence. Same-user code/key tampering, local privileged compromise, filesystem snapshot rollback and memory forensics are outside current proven guarantees; JS strings/GC do not guarantee secret erasure. Clock rollback is rejected relative to durable state, but restoring all local state requires an external anti-rollback witness before stronger claims. Protect and retain the encrypted vault independently; do not accept a caller boolean as storage-isolation proof.

The library is functional against synthetic signed fixtures and temporary storage, not an independently accepted operational service. Receipt/schema success never enables native acceptance, ADMINIT Execute, Q01 closure or proof VERIFIED. Local setup and physical execution require separate approval; nothing starts at application startup.

References checked live: [GitHub OIDC discovery](https://token.actions.githubusercontent.com/.well-known/openid-configuration), [OIDC claims](https://docs.github.com/en/actions/reference/security/oidc), [job API](https://docs.github.com/en/rest/actions/workflow-jobs). Discovery advertises check_run_id; no invented job_id claim is used. Actual signed claim types and PR/source relation still need real-platform qualification.
