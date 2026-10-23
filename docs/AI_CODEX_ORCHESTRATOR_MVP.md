# AI/Codex Orchestrator — isolated planning MVP

Base commit: `6c969ab049206c4f7f8c7348ff2148a352abd5b2`.

## Scope
This branch adds a **pure policy validator**, not an execution orchestrator. It does not start Codex, invoke LLMs, parse books, touch SQLite, issue proof certificates, deploy or publish. It is deliberately fail-closed and does not claim to close Q01.

## Stages and roles
INGEST/ingestion -> GAP_SCAN/research -> HYPOTHESIS/research -> ADAPTER_BUILD/codex -> SANDBOX_TEST/test -> PROOF_CHECK/kernel -> RELEASE_CANDIDATE/publisher.

The policy accepts only untrusted input hashes and a pinned source commit. Network, production writes and kernel writes are forbidden. Limits are wallSeconds <=600, memoryMb <=1024, outputMb <=50, llmTokens <=20000, attempts <=2. RELEASE_CANDIDATE is currently **always rejected**. A task-supplied approval flag is forbidden: only a future trusted publication service can authenticate an owner and bind approval to exact immutable artifacts. A caller-supplied proofVerified boolean never yields a VERIFIED status.

## Future implementation gates
1. Content-addressed artifact store, immutable provenance and review of PDF/OCR text as untrusted data.
2. Durable queue and lease fencing after independent Q01 resolution. Never hold SQLite transactions during external jobs.
3. Isolated Codex execution with pinned toolchains, no secrets, no network, bounded resources and signed test receipts.
4. Independent proof kernel in a separate trust boundary; LLM and adapters cannot elevate CANDIDATE to VERIFIED.
5. Human owner approval bound to exact commit, proof certificate and artifact hashes; publisher separate from execution workers.
6. Recovery and regression matrix: race, crash, stale lease, invalid proof, substituted receipts, resource exhaustion, source drift.

## Open risks
P0: independent proof and execution isolation not implemented.
P1: Q01 first-open failure unresolved; DatabaseSync full-jobs rewrite scalability.
P2: durable cost accounting, telemetry, signed receipts and checkpointing pending.

Run isolated policy tests with `node --test tests/ai-orchestrator-policy.test.mjs`.

## Deterministic planning state machine
`src/ai-orchestrator/plan.mjs` provides in-memory transition validation with generation checks and caller-supplied lease tokens. This is **not durable fencing**: it has no persistence, trusted token issuer, expiry clock, process isolation or cross-process compare-and-swap. Do not connect it to workers until these controls and Q01 are independently verified. `REVIEW_REQUIRED` is terminal; no VERIFIED, RELEASED or production transitions exist.

## Receipt boundary
`src/ai-orchestrator/receipts.mjs` validates strict receipt fields, pinned input hashes, attempt and resource budgets. A syntactically valid receipt is explicitly labelled `SELF_REPORTED_UNATTESTED`; no signature, trusted clock, isolated runner identity, replay prevention, artifact byte verification or independent kernel proof is established. It MUST NOT be used to authorize VERIFIED, release or production actions. Receipts are metadata checks only until a separate trusted verifier is implemented.

## Offline artifact integrity
`src/ai-orchestrator/artifacts.mjs` compares the SHA256 of actual Uint8Array bytes with an expected digest. A match is integrity evidence only; the expected digest and the producing identity remain unauthenticated. This cannot turn a self-reported receipt into a trusted proof or authorize publishing. Never accept a digest provided solely by the untrusted worker as independent evidence.

## CI and attempt limits
The in-memory plan now copies `budget.attempts` to `maxAttempts`; zero permitted attempts means no lease. This remains a local invariant, not durable resource accounting. `.github/workflows/ai-orchestrator-policy.yml` runs isolated offline tests on Node 22/24. A queued, skipped or missing CI job is NOT_RUN/BLOCKED, never PASS. GitHub-hosted checks cannot substitute for independent proof or physical acceptance.

## Receipt-to-bytes correlation
`matchReceiptAndOutput(task, receipt, outputBytes)` combines task/receipt metadata checks with SHA256 over actual output bytes. A PASS receipt is still self-reported, not signed or independently attested; a matching digest does not imply proof validity. Keep all production, publication and VERIFIED gates closed.

## Actual output budget
`matchReceiptAndOutput` rejects actual byte arrays larger than `budget.outputMb * 1024 * 1024`, regardless of self-reported receipt metrics. This does not limit the bytes read into memory before invocation: the future isolated runner must enforce streaming and OS-level limits before accepting an artifact.

## Bounded streaming integrity
`verifyArtifactStream(asyncIterable, expectedSha256, {maxBytes})` checks total actual bytes before each hash update and aborts when a chunk would exceed the limit. The caller must provide a trusted expected digest and enforce upstream chunk size, disk limits, runtime and isolation separately. This module provides neither executor attestation nor mathematical verification.

## Runner identity claims
`claims.mjs` performs only strict schema and cross-record consistency checks on self-reported runner ID, runner image hash, toolchain hash, source commit, receipt hash and attempt. It returns `UNATTESTED_CLAIM` even when metadata agrees. A trusted runner registry, authenticated signatures, anti-replay nonce, trusted timestamp and independently computed receipt hash are not implemented. Do not accept this claim as executor identity or as a release gate.

## CI provenance regression (2026-10-23)
PostgreSQL Integration full-suite CI at commit `7156349e9a99b1e89235ffc772aa25304a8cd76d` failed the `ci-provenance.test.mjs` check because this PR's offline workflow used mutable `actions/checkout@v4` and `actions/setup-node@v4`. Both are now pinned to immutable 40-character commits. Re-run of the full integration matrix on the corrected exact HEAD is required; prior green offline policy runs do not imply integration PASS.

## Receipt claim byte binding
`correlateExecutionClaimWithReceiptBytes(task, receipt, claim, receiptBytes)` now checks SHA256 of the original receipt bytes and exact parsed record equivalence (1 MiB cap), preventing an unverified `receiptHash` from being treated as a binding. This remains untrusted, unsigned metadata. Authentic signature verification, trusted key enrollment, anti-replay persistence and durable runner fencing remain outstanding.

## Offline replay simulation
`replay.mjs` models rejection of repeated `(taskId, attempt)` claims within one immutable in-memory filter (max 10,000 entries). This is **not** a durable replay ledger: the state can be reset or forged, and no atomic transaction, signature or authenticated caller is provided. Production replay prevention must be enforced by a trusted durable store with unique constraints and atomic receipt registration, not by this helper.

## Offline evidence integration
`inspectOfflineEvidence` composes task policy, receipt metadata, actual output bytes, receipt-byte claim binding and the ephemeral replay filter. It only returns `NOT_VERIFIED` and `DENIED` for proof and publication. The returned replay filter must be passed by the caller; it is not a durable transaction. No trusted runner, signature verification, proof kernel or production authority is implied.

## Durable receipt registry prototype
`registry.mjs` uses `node:sqlite` `DatabaseSync` and a unique SQLite primary key `(task_id, attempt)` to reject duplicate registrations across connections and restarts. The API is a standalone owner-side prototype and is NOT wired into `inspectOfflineEvidence`, a trusted runner or any production path. Registration must only occur after independently trusted evidence validation; currently it records `REGISTERED_UNATTESTED`. SQLite busy handling, schema migration, hostile database files, crash/fault injection and full Q01 compatibility need independent acceptance before integration.

## SQLite schema guard limitation
The registry now checks that the pre-existing table DDL contains the expected composite primary-key declaration and refuses an obviously incompatible table. This textual DDL check is preliminary, NOT a complete trusted schema attestation: equivalent formatting, spoofed SQL text, index corruption, triggers, views, foreign database state, first-open concurrency and adversarial files require structural PRAGMA-based verification and fault-injection tests. Q01 remains OPEN.

## Structural SQLite metadata guard
The registry now inspects `PRAGMA table_info`, `PRAGMA index_list`, `PRAGMA index_info`, and `sqlite_master` object types rather than searching CREATE TABLE SQL text. It rejects unexpected columns, primary-key drift and table triggers. This is not complete adversarial database validation: CHECK constraints, writable_schema, attached databases, corruption, first-open races, durability settings and crash behavior still require explicit hardening and independent tests. Q01 is not closed.
