# Book PostgreSQL staging backend and transfer runbook

Audit completed 2026-10-17 on `feat/book-postgres-backend`, based on
`bd53ee7486f145dbcc1fc2db8fb13eb04cd7999f`. No production migration, automatic
switch, push or merge was performed.

## Status: cutover blocked

**`native-json-text-parity` keeps compatibility closed, including when an operator
supplies the exact confirmation.** Native SQLite accepts U+0000 and lone UTF-16
surrogates in strings/keys. PostgreSQL jsonb rejects these values (NUL reproduced
as SQLSTATE 22P05). Stripping/replacing evidence is unacceptable. The current
PostgreSQL adapter is an explicit staging implementation for representable data,
not a fully interchangeable production backend.

`planBookTransfer` reports `unsupportedIds` and the global blocker without
including source text. `applyBookTransfer` rejects unsupported snapshots before
opening its write transaction. Native PostgreSQL enqueue/import also fails closed
without committing partial data. The original SQLite remains untouched. Future
work must choose a lossless representation, retain integrity/provenance constraints
and pass complete text-contract tests before removing this blocker. No operator
confirmation, environment variable or successful subset test overrides it.

## Inventory and implementation

See `book-postgres-backend-design.md` for the SQLite inventory. Both queue APIs
reuse `queue-contract.mjs`: deterministic SHA-256 identity, original-payload
enqueue deduplication, attempts, acquire/renew/checkpoint/complete/fail fencing,
metrics, digest-pinned immutable receipts and export/import. Snapshot restoration
requires an empty native queue and invalidates old tokens. Job completion stores
scientific proposals; neither completion nor an approved stored receipt proves
a claim. Existing graph import still independently validates scientific evidence
and human review. No transfer module writes to the graph or invokes an AI provider.

Separate Book migrations create:

| Table | Purpose |
| --- | --- |
| `mu_book_schema_migrations` | Separate idempotent migration ledger |
| `mu_book_queue` | Singleton metadata and bounded queue transaction lock |
| `mu_book_jobs` | Original deterministic ID, stable PostgreSQL decimal-string ID, order and document |
| `mu_book_reviews` | Digest-pinned mirrored human receipt, cascading with job deletion |
| `mu_book_imports` | Source/target hashes, inserted IDs and hashes, current head, rollback/activation state |

SQL checks reject missing/null source pins, invalid lifecycle/lease/completion
shapes, and malformed receipt fields; FK constraints protect review ownership.
Deterministic ID recomputation, limits, immutable receipt decisions, source pins,
cross-row receipt/result consistency and numeric metrics are checked by the shared
application transaction. Direct administrative SQL is trusted and can bypass
application semantics. The PostgreSQL deployment is not an untrusted multi-tenant
SQL API. All writers must use the singleton-lock transaction adapter.

The original limits are preserved: 1000 jobs, 8 MiB snapshot, 64 KiB payload,
256 KiB JSON fields, maxAttempts 1–10. PostgreSQL uses its clock by default;
injected clocks are for synthetic tests. This deliberately retains the bounded
SQLite architecture, rather than introducing a distributed high-throughput queue.

## Explicit API sequence (staging only)

The application does not select this backend automatically. The caller supplies
a dedicated pool, owns its lifecycle and explicitly invokes schema migrations.

```js
import {applyBookMigrations} from '../src/book-ingestion/postgres-migrations.mjs';
import {openPostgresBookQueue} from '../src/book-ingestion/postgres-queue.mjs';
import {planBookTransfer, applyBookTransfer, verifyBookTransfer,
        rollbackBookTransfer} from '../src/book-ingestion/postgres-transfer.mjs';
import {assessBookPostgresGate} from '../src/book-ingestion/postgres-gate.mjs';

// Obtain a logical snapshot from the existing SQLite queue. Do not copy a live
// queue.sqlite file; protect the exported backup because it contains source data.
const snapshot = await sqlite.exportSnapshot();
const offlineReport = planBookTransfer({snapshot}); // pure: no database writes

// Only a dedicated, authorized staging database is appropriate at this stage.
await applyBookMigrations(pool); // explicit, separate Book ledger
const postgres = await openPostgresBookQueue({pool});
const dryRun = planBookTransfer({snapshot,
  targetSnapshot: await postgres.exportSnapshot()});
// Review conflictIds, skippedIds, unsupportedIds and blockers. Do not discard
// source rows or bypass errors. Save the original backup and source hash.
const expectedHash = dryRun.snapshotHash;
// Supported-data staging rehearsal only; this is never called by service startup.
const receipt = await applyBookTransfer({pool, snapshot, expectedHash});
const verification = await verifyBookTransfer({pool, snapshotHash: expectedHash});
const mapping = await postgres.identityMap(); // [{sqliteId, postgresId}]
const gate = await assessBookPostgresGate({pool, snapshotHash: expectedHash});
// gate.compatible === false while native-json-text-parity exists.
await rollbackBookTransfer({pool, snapshotHash: expectedHash});
```

Use the queue's configured `maxAttempts` consistently (default 3); a mismatch is
rejected. Reports distinguish identical skipped rows from conflicting identities;
unsupported rows abort the apply, rather than silently disappearing. Source hash
means canonical JSON SHA-256, not raw snapshot-file bytes. Hash verification checks
snapshot consistency, not the physical PDF; workers independently revalidate PDFs.

Apply locks the queue, rechecks conflicts and writes jobs, ID mappings, reviews
and receipt in one transaction. A database error after the first row rolls back
the entire import. A retry of a committed import returns its receipt without
overwriting later work. Reverification must still pass before any future cutover.
Imported active leases lose their old tokens and become queued/failed according
to attempts; projected timestamps remain those of the snapshot for deterministic
hashing. Native importSnapshot separately retains its existing restore-time behavior.

Rollback is allowed only before activation and while all inserted rows match their
recorded hashes. It preserves pre-existing and unrelated later rows. Repeated
rollback is idempotent; explicit reapply after rollback rebuilds the receipt and
recomputes current-head evidence. Later job work invalidates pre-cutover evidence.
Backup/restore can be rehearsed in a new empty store using exportSnapshot and
importSnapshot. Original SQLite storage is never deleted or modified by transfer.

The future operator phrase binds source hash, projected target hash and current
target-head hash and explicitly asserts `SOURCE SQLITE QUIESCED`. The caller must
authenticate that operator and stop SQLite intake/workers; a database hash cannot
establish external-process quiescence. This phrase is not a password, capability
or automatic switch. The current blocker prevents activation even with the phrase.

## Verification and limits

* Node 22.23.3 and Node 24.20.0: **283/283 each**, zero failure/skip/cancellation;
  native PDF and disposable PostgreSQL enabled.
* Two simultaneous Node 22/24 real-PostgreSQL processes: **20/20 each**, isolated
  schemas. Local PostgreSQL 18.1; PostgreSQL 16 is covered by the updated CI matrix
  configuration but has not run for these unpublished commits.
* Browser E2E: **14/14**, Chromium, one worker, retries disabled.
* Tests reproduce partial SQL rollback, killed writer recovery, duplicate claims,
  all stale token mutations, exhaustion, corrupted snapshots, receipt/provenance
  preservation, deterministic large-snapshot hashes, rollback/reapply and text
  incompatibility. Real candidate dimensional/numeric evidence survives unchanged;
  claims remain `untested`, and a forged `proven` candidate is rejected.

Only synthetic sources were used. Real books, production deployment and production
migration remain outside scope. The generic `assessBookQueueCompatibility` remains
unchanged and closed; no generic ingestion store is substituted for the Book store.
Raw test logs are in `outputs/book-backend-*` outside this worktree. GitHub Actions
for the local commits are pending separate publication.
