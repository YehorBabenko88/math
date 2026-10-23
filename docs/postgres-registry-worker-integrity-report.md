# PostgreSQL registry, worker and migration integrity remediation

Date: 2026-10-19. Branch: `fix/postgres-registry-worker-integrity`. Exact starting tree: `740f35742aa585f67471edea2fab5f5205a321f6`. This branch addresses only integration audit R02, R03 and R10. It does not integrate other remediation branches, change PR #1–#9, or open the Book production gate.

## R02 — lossless registry snapshots

`createPostgresAdapterSnapshotStore.save()` validates the public registry state machine, then stores an explicit `math-universe-adapter-snapshot/v1` envelope containing the **exact original registry JSON string**. The column's schema version remains the registry schema version. JSONB can reorder envelope keys without touching the original proposal key order, Unicode, NUL or lone surrogates inside the nested string. Proposal fingerprinting and existing IDs are unchanged.

`latest()` verifies SHA-256 against the stored exact JSON, checks the column schema version and restores every proposal through the public validation/review state machine. Unsupported envelope formats, checksum corruption and inconsistent IDs fail closed. Legacy JSONB is readable only when its reconstructed exact bytes match the historical checksum and all original IDs verify. Many populated legacy rows cannot satisfy this because JSONB discarded insertion order; they remain blocked. No canonicalization or historical ID rewrite is attempted. An explicit `save(originalRegistry)` can safely re-encode a matching existing checksum when the original exact, fingerprint-valid bytes are supplied; it does not invent those bytes from JSONB.

Live tests exercise proposed/approved state, exact JSON and ID roundtrip, Unicode/NUL/lone surrogates, corrupted checksum, unverifiable legacy rejection, verifiable empty legacy restoration, and explicit resave without an additional row. The previous order-preserving mock now returns the checksum and schema columns required by the real persistence contract.

## R03 — explicit fenced service protocol

`startIngestionService()` accepts `MATH_UNIVERSE_INGESTION_MODE=fenced` and explicitly wires `createFencedIngestionJobStore()`. It verifies persisted protocol activation before polling and never migrates or activates the protocol itself. An unknown mode fails before loading pg. Omitting the setting retains the existing **unfenced legacy service**; that compatibility mode is not represented as safe token fencing.

Additive `sql/005_ingestion_service_protocol.sql` installs a legacy-default protocol row and guarded DML. It does not change SQL001–004 or any Book migration. A separate administrative call to `enableFencedIngestionService(pool)` takes an exclusive advisory barrier, rejects **every running lease**, and persists fenced mode. It forces READ COMMITTED; direct SQL activation under stale isolation is rejected. No boolean acknowledgement substitutes for this barrier.

All job DML takes the shared barrier before row work. Guard reads lock the persisted protocol row, so old REPEATABLE READ snapshots serialize-fail after activation. In activated mode, the database rejects legacy claim/renew/complete/fail, unguarded checkpoint/result changes, DELETE and TRUNCATE. The producer's enqueue/dedup remains compatible, including exact no-op duplicate inserts for running/completed jobs. Fenced operations supply per-acquisition transaction-local capability; old tokens cannot mutate reacquired same-worker jobs. Capability UUID spelling is canonicalized only for comparison, preserving the public API's case-insensitive UUID acceptance.

The fenced store now requires **pg-compatible `pool.connect()`**, transaction-capable client query/release, and explicit READ COMMITTED transactions. A query-only pool is rejected rather than silently bypassing the barrier. Both activation and store operations rollback failures and discard clients when rollback fails. Tests cover connection rejection, mutation failure, release behavior, rollback failure, unchanged capability after transaction boundaries, and service-level stale completion after same-worker reacquisition.

The protocol table and administrative activation function revoke PUBLIC privileges. SECURITY DEFINER helpers pin `pg_catalog`, the exact trusted schema, and `pg_temp`. A restricted NOLOGIN runtime role test completes a service job through public read-only status plus permitted job DML while being denied protocol changes and activation. A GUC is **not authentication against a caller allowed arbitrary SQL and token reads**, and neither triggers nor ACLs constrain a database owner/superuser who can disable or replace them. Keep legacy processes stopped; the guard proves writes are rejected, not process exit. No production roles, services or databases were changed.

## R10 — generic raw-byte checksum history

`applyMathMigrations()` now reads every script on every run, validates raw UTF-8, hashes exact bytes under `sha256-raw-utf8/v1`, and validates a strict checksummed prefix before applying pending SQL. The runner validates schema CREATE ownership, table/catalog shape, NOT NULL typed columns, primary key, timestamps, known filenames and checksums. Qualified ledger access and catalog-first metadata resolution defeat temporary ledger shadowing. Execution uses an explicit READ COMMITTED outer transaction and transaction advisory lock; the existing wrapper lexer is retained.

A populated filename-only ledger fails `MATH_MIGRATION_HISTORY_UNVERIFIED` without adding hashes or applying DDL. Today's source is never treated as evidence of historical execution; `acceptCurrentHashes` has no effect. An empty filename-only ledger may bootstrap. There is no automatic adoption API for unverifiable existing histories. The four-script upgrade fixture executes captured exact bytes and records those same hashes in the same transaction; it does not backfill an unknown database.

Live coverage includes source drift/BOM/newlines/trailing bytes, non-prefix history, views/nullable checksum columns, temporary shadows, concurrent replay under stale default isolation, failure before COMMIT, lost acknowledgement after COMMIT, and actual child-process exit before/after COMMIT. The existing generic mock fixtures now model catalog/checksum state with exact fixture-source hashes, and existing live migration assertions expect the fifth additive script without weakening DDL/atomicity assertions.

## RED/GREEN and verification

Before implementation, the new registry, service wiring and migration integrity tests failed on the missing behavior. Baseline probes using the original modules from the exact starting tree independently reproduced R02's real JSONB fingerprint mismatch, R03's same-worker stale legacy overwrite, and R10's zero applied-source reads on both disposable PG16 and PG18. Retained outside Git: `outputs/fix-postgres-red-baseline.mjs` and `.log`. Parent review also identified producer duplicate enqueue and uppercase UUID edges; each received an observed failing regression before the minimal fix. Additional stale-isolation activation was observed RED before its explicit isolation fix.

Final local executable tree: all tests below ran without name filters or excluded test files. Node22 is 22.23.3; Node24 is 24.20.0. PG16/18 are the existing isolated disposable loopback clusters on ports 55440/55439. Each fixture owns a random UUID schema and cleans up only that schema (and its explicitly created random test role). Shared clusters and unrelated historical schemas were neither stopped nor altered.

| Check | Result | Log outside Git |
| --- | --- | --- |
| `node scripts/test-full-ci.mjs`, Node22 × PG16 | 80 files, 397 passed; 0 fail/cancel/skip/todo | `outputs/fix-postgres-node22-pg16.log` |
| Same, Node22 × PG18 | 80 files, 397 passed; 0 fail/cancel/skip/todo | `outputs/fix-postgres-node22-pg18.log` |
| Same, Node24 × PG16 | 80 files, 397 passed; 0 fail/cancel/skip/todo | `outputs/fix-postgres-node24-pg16.log` |
| Same, Node24 × PG18 | 80 files, 397 passed; 0 fail/cancel/skip/todo | `outputs/fix-postgres-node24-pg18.log` |
| Dedicated Native PDF profile | 76 passed; 0 fail/skip/todo | `outputs/fix-postgres-native-pdf.log` |
| Browser Chromium on owned port4176, retries0 | 14 passed | `outputs/fix-postgres-browser.log` |
| `git diff --check` | PASS | Git output |

The first full run had 381 passed and two failures: a relative local Python path failed after the parser changed cwd, and an inherited lexer assertion still expected four migrations. The Python executable was supplied by absolute path; the assertion now expects the fifth script while retaining its exact function-body/replay checks. All final matrix cells above were rerun after the last executable change. Dedicated PDF/Browser exercise unchanged paths and also ran successfully. The bundled zero-skip full runner includes all PDF and database tests.

Implementation commits: `41bd044` (R02), `7b2dc93` (R03/R10), followed by the reviewed UUID compatibility regression/fix. The exact final commit and GitHub Actions run URLs are supplied in the publication handoff to avoid self-referential commit hashes. Publication is only an ordinary push of this branch; no PR creation, merge, rebase, force push, protected settings or production migration is authorized or performed.

## Limits and disposition

R02 is fixed for new lossless snapshots and verifiable historical bytes; unverifiable old JSONB remains an explicit recovery blocker. R03 is fixed for explicitly activated generic fenced service mode; deliberately retained legacy mode still has legacy semantics. R10 is fixed for fresh/verified generic histories; nonempty filename-only historical ledgers require independently verified historical evidence or a separately reviewed reconstruction plan. The branch adds no adoption shortcut.

This is synthetic local/CI qualification, not production deployment qualification, real-book scientific validation, Windows service install/reboot testing, authenticated operator provisioning, or a proof against privileged database owners. The Book cutover/controller/backend and immutable SQL001–004/Book001–005 are unchanged. The production gate remains closed. No integration or production readiness claim follows from these checks.
