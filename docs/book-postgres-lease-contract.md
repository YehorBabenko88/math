# Common ingestion lease record

`src/ingestion-lease-contract.mjs` defines a read-only `mu-job-lease/v1` representation. `normalizeSqliteBookLease(job)` accepts an actual leased SQLite Book job; `normalizePostgresIngestionLease(claim)` accepts an opt-in fenced PostgreSQL claim including `worker_id`. Neither function acquires, renews, migrates or writes a job.

| Field | Contract |
| --- | --- |
| `schemaVersion` | `mu-job-lease/v1` |
| `store` | `book-sqlite` or `postgres-ingestion` |
| `jobId` | String formed from `store + ':' + nativeJobId`; prevents collisions across these two store kinds |
| `nativeJobId` | Original SQLite SHA-256 ID or PostgreSQL positive bigint decimal string, with no numeric precision loss |
| `claim_token` | Exact native SQLite `token` (64 lowercase hex) or PostgreSQL `claim_token` (UUID); opaque per-acquisition identity |
| `leaseUntilMs` | Safe integer epoch milliseconds; PostgreSQL native `Date` or exact ISO UTC timestamp is converted explicitly |
| `workerId` | Actual native `workerId` or `worker_id`; never synthesized from a caller's worker name |
| `attempt` | Positive integer from native `attempts` |
| `payload` | Detached, recursively frozen JSON object preserving source/version/license/scope data already stored there |
| `checkpoint` | Detached, recursively frozen JSON object, or `null` when absent |
| `provenance` | SQLite `{sourceHash, edition, page, extractionVersion}`, verified against its deterministic ID; PostgreSQL `null` because its generic claim has no equivalent source-pin columns |

Payload/checkpoint conversion rejects executable accessors, custom objects, cycles and invalid JSON. PostgreSQL bigint IDs above JavaScript's safe integer range must be strings. No source metadata is inferred from a generic PostgreSQL payload. A namespace identifies the store kind, not a database instance: callers aggregating several databases/directories must retain their separate connection/store identity. A normalized record is a snapshot, not evidence of current lease ownership; every write still requires the authoritative native fence and expiry check.

## SQLite renewal

`await queue.renew(id, token, {leaseMs})` is additive to the existing Book queue API. It validates the same current acquisition token and strictly unexpired lease as checkpoint/complete/fail, inside the same SQLite `BEGIN IMMEDIATE` transaction. At exact expiry (`now >= leaseUntil`) renewal rejects. A reclaimed job has a new token even when the worker name is reused.

The duration is an integer from 1 through 86,400,000 milliseconds. Renewal sets expiry to `now + leaseMs`; it can shorten an existing lease when a shorter duration is requested. It preserves the acquisition token, worker identity, attempt count, payload and committed checkpoint. It does not consume another attempt or resurrect an expired/completed job. The injected clock and synchronized wall-clock requirement remain unchanged.

## Native boundaries and substitution gate

SQLite continues using `acquire({workerId, leaseMs, jobId?})`, `renew(id, token, {leaseMs})`, `checkpoint(id, token, object)`, `complete(id, token, {result, metrics})` and `fail(id, token, options)`. PostgreSQL keeps its own `claim`, object-argument fenced methods, lease durations in seconds and SQL persistence semantics. Normalization does not make either API interchangeable.

`assessBookQueueCompatibility` recognizes the SQLite native `token` as well as historical aliases. Both `compatible` and `fullBookstoreSubstitution` remain **false**, including when both stores have fenced leases and checkpoints. The legacy reason code `checkpoint-and-review-contract-not-implemented` is retained for callers; `missingContracts` explicitly lists identity migration, review persistence and snapshot mapping. No automatic cross-store bridge, human-review mapping, snapshot conversion, source identity migration or graph import is implemented. A completed queue job never implies scientific approval.

Restored SQLite snapshots still invalidate active leases. No migration/schema version change is needed for renewal. Private payloads, checkpoints and tokens must not be logged or published as telemetry.
