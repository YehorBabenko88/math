# Book Operator Cutover Controller audit

## Scope and status

Base: `8f666159da165e04999133fbe76bd0805a36b617`; branch `feat/book-postgres-cutover-controller`.
This implementation is an explicit **isolated rehearsal** API, not a production routing switch. Production mode is rejected at construction. Existing `assessBookPostgresGate` remains closed with `operator-cutover-prerequisites`. No application startup imports or automatically invokes the controller.

## Existing guarantees and gaps

Existing SQLite and PostgreSQL queues share native job identity, bounded JSON, provenance, review receipts and strict live claim tokens. Transfers validate source/target hashes, clear restored leases, preserve unapproved candidates, and support idempotent rollback. Lossless encoding preserves the SQLite JSON contract. Migration checksums and advisory locks already protect migration reapplication.

Existing plaintext confirmation was unreachable behind the closed gate and is not accepted by this controller. There was no durable operator-session verifier, cross-connection source barrier, tested physical restore witness or cutover journal. Worker stop/drain is process-local; no global Book worker supervisor or trusted deployment identity provider exists.

## Implemented contracts

- `operator-session.mjs`: externally signed Ed25519 sessions with pinned public key, issuer/audience, run/resource binding, explicit scopes, bounded TTL and expiry. The verifier handles inert data only; tests use ephemeral synthetic keys. Journal records only actor/session hashes, never the signed credential, private key or raw subject.
- `cutover-source.mjs`: `BEGIN EXCLUSIVE` serializes the freeze against existing transactions. Persistent triggers reject ordinary writes across existing and old connections. Native queue mutation entry points also reject no-op enqueue/claim. Frozen reopen does not recover leases by writing. Schema/trigger fingerprints and source hashes are rechecked. Reads remain available.
- `cutover-backup.mjs`: physical `VACUUM INTO` after freeze, integrity check, SHA-256, a fresh physical restore and independent native logical import. Restore verifies native lease invalidation. Existing artifacts are revalidated; partial/corrupt artifacts are preserved and rejected, never silently overwritten. Backup verification runs again before transfer, verification, READY and simulated activation.
- `003_cutover_guard.sql`, `cutover-postgres.mjs`: explicit STAGING fence. Monotonic generations rotate a random in-memory capability; only its hash is stored. Native writer/guard lock ordering serializes in-flight transactions. Old pools and capabilities cannot write; active leased target jobs reject fencing. No helper opens the guard.
- `cutover-journal.mjs`: separate SQLite journal, FULL synchronous durability, atomic claims, hashed tokens, expiring leases, monotonic generations, exact transition edges and a verified hash chain. Concurrent callers cannot own a live claim; stale completions cannot advance or fail a successor. Expired claims may be reclaimed after restart, without skipping evidence.
- `cutover-controller.mjs`: PREPARE → QUIESCE → BACKUP → TRANSFER → VERIFY → READY → ACTIVATED; failures retain fences. Scope is checked both before and after claiming to avoid the cross-process status/claim race, and after asynchronous effects. Each step rotates the target capability. READY rechecks restored backup/source/target; ACTIVATED repeats checks and records `simulated: true`, `backendSwitched: false` only. Repeated simulated activation is idempotent.

## Operational API

A trusted caller provisions `createOperatorSessionVerifier`, binds a run UUID and resource SHA-256, explicitly applies Book migrations to an isolated target, then opens `openBookCutoverController({directory,backupRoot,pool,runId,resourceId,verifier,mode:'rehearsal'})`. Call `prepare({session})`, then individual `advance({session})` operations. Inspect `status()` and always `close()` the journal. Never put sessions in command arguments or logs.

Crashes before journal commit leave durable source/target fences. A new claim generation revalidates artifacts and retries the same stage. Transfer ledger replay is idempotent. Partial backups deliberately require authenticated operator investigation; they are not automatically deleted. FAILED runs do not automatically thaw either backend. A long-running step that outlives its claim cannot commit; no background heartbeat hides an abandoned operation.

## Unproven production prerequisites (gate remains CLOSED)

1. Pinned-key provisioning, actual identity-provider integration, revocation and operator policy are deployment responsibilities, not established by an injected verifier or signed synthetic test session.
2. Storage fencing is proven for supported queue operations and ordinary SQL, **not proof that every worker OS process stopped**. SQLite old binaries rewrite the entire table, so graceful draining cannot be distinguished from new claims at trigger level. This controller freezes all writes and restores outstanding leases instead of claiming global graceful drain.
3. A privileged filesystem/SQLite owner can drop triggers or replace files. A PostgreSQL owner can disable triggers or alter guard tables. Independent role isolation and process/deployment attestation are absent. Hash chains detect accidental/non-rehashed tampering; they are not externally anchored signatures against a privileged journal owner.
4. Target database/schema/port identity is suitable for this isolated staging contract, not authenticated production server identity or TLS attestation. Runtime writer routing is not implemented. Both stores remain fenced after simulated activation.
5. Source and PostgreSQL cannot participate in one atomic distributed transaction. Repeated checks and durable fences are fail-closed staging evidence; they do not establish a production distributed cutover protocol.
6. Native APIs cannot stop a malicious process with arbitrary filesystem/DDL privileges. No claim is promoted to proven and external-AI permissions are preserved by existing transfer validation.

## Validation

See the accompanying local report for the final Node 22/24 × PostgreSQL 16/18 matrix, Native PDF, Browser E2E and exact output paths. Regressions cover signed-session failures, expiry, concurrent/stale claims, journal corruption, old worker renew/complete, no-op writes, physical corruption, actual restore, competing controllers, post-verify backup damage, scope races, target generation changes and repeat simulated activation. Only temporary synthetic queues and per-test UUID PostgreSQL schemas are used.

Final validation (2026-10-18): Node 24.20.0 and 22.23.3, each against PostgreSQL 16.15 and 18.1: **331 passed, 0 failed, 0 skipped** per combination, with `BOOK_INGESTION_PYTHON` enabled and test concurrency 4. All four suites also ran concurrently against isolated UUID schemas. Browser E2E: **14 passed**. Final diff whitespace checks passed. Logs live outside Git in `../../outputs/book-cutover-node{22,24}-pg{16,18}.log` and `book-cutover-browser.log`.

Lease nuance: expiry prevents a stale controller from publishing journal evidence immediately; its PostgreSQL capability is revoked when the successor rotates the target guard. Rotation waits for in-flight transactions before proceeding. This is not immediate distributed lease revocation, and production safety is not claimed from this staging mechanism.
