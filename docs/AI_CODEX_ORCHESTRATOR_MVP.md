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
