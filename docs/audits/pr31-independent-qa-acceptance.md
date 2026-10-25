# Independent PR31 QA acceptance — 2026-10-25

Candidate SHA: `cb168925b5aeec0c957137dd94ab72c64f0bd333`.
Candidate tree claimed: `10cfd29f5d2c75e841d88dd70bef8773dada8287` (must independently resolve; not attested by this document).
Scope: no merge, deployment, production or physical tests.

## Confirmed P1 finding: Q01 retry sentinel swallowed
At candidate HEAD `src/book-ingestion/queue.mjs`, an initialization race throws an error tagged `BOOK_QUEUE_INITIALIZING` after seeing a preexisting empty database. The transaction catch converts it into generic `Invalid queue state`, so the outer bounded retry loop cannot identify it. This branch preserves that sentinel only for initialization. Do not consider Q01 closed without deterministic RED on candidate, GREEN on patched commit and independent Windows/Linux verification.

## Required 12 Q01 cells
OS ubuntu-latest/windows-latest × Node 22/24 × quick/fault/stress. Every cell must have terminal job status, no skipped mandatory cases, correct source identity, independent verifier, and an artifact ZIP with JUnit/JSONL/SHA256 provenance bound to run ID and attempt. The coverage aggregator must not treat a skipped, cancelled or pending job as PASS. Native-free Windows containment is not physical acceptance.

## Separate matrix
- PostgreSQL: Node22/24 × PG16/18, all four cells independently checked.
- Detached journal: Windows/Linux × Node22/24, four cells.
- Mathematical kernel, Knowledge Graph, AI policy, native PDF, Browser E2E, Windows deployment contracts, and Validate Math Universe: separate required results.
- Push and PR attempts must be evaluated separately. PR merge refs cannot substitute for source-head push evidence. Never fallback to an older green attempt after a newer failed/queued attempt.
- Artifact ZIP: verify ID, run/attempt, complete file inventory, byte digests, JSONL events and JUnit testcase totals. A successful workflow alone is insufficient.
- Fault injection and mutation controls must include first-open concurrency, partial schema, stale lease, detached journal, wrong HEAD, altered ZIP and missing/skipped jobs.

## Decision
PASS only for independently verified mandatory evidence on exact source/tree. FAIL for observed invariant break. BLOCKED for missing, pending, skipped or unverified mandatory evidence. NOT_RUN for tests not executed. Q01 OPEN, integration NO-GO, production NO-GO until complete independent acceptance.
