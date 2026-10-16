# Explicit Book PostgreSQL backend

## Inventory and design

SQLite `openBookQueue` is the authority for the Book contract. Each job has a
SHA-256 ID over JSON `[sourceHash,edition,page,extractionVersion]`; enqueue returns
the first matching identity, even when the later payload differs (the worker
checks conflicting intake policies). Jobs preserve source hash, edition, 1-based
page, extraction version, payload (including source version/license/scope), state,
attempts, token/lease/worker, timestamps, checkpoint, result, metrics and errorCode.
Limits: 1000 jobs, 8 MiB snapshots, 64 KiB payload, 256 KiB JSON fields, maxAttempts
1–10. Leases use 32 random bytes; renewal and every write require an unexpired
token. Expired jobs retry or fail at maxAttempts. SQLite serializes writes with
BEGIN IMMEDIATE and uses synchronous=FULL. Export is a logical snapshot, not a
live file copy; import requires empty storage and invalidates all active leases.
Review receipts are immutable, digest-pinned, idempotent, and stored in completed
result.reviewReceipt; metrics.reviewDecisions becomes 1. The queue stores a human
receipt but does not itself prove a claim. Worker/graph layers validate candidates
and approval separately. Backup/restore is exportSnapshot/importSnapshot.

Extract the existing pure validators/transitions into a shared Book contract,
keeping SQLite API and behavior intact. Add explicit `openPostgresBookQueue` with
the same methods. PostgreSQL serializes each bounded queue using its metadata row
lock; it stores Book documents, original deterministic IDs, numeric PostgreSQL IDs
and review receipts under a dedicated Book schema migration ledger. No generic
ingestion table or automatic backend substitution is used. Ordered ordinal data
preserves SQLite ordering. PostgreSQL clock is authoritative unless a synthetic
test clock is explicitly injected. This is a bounded queue, not a new distributed
high-throughput scheduler.

Migration accepts an immutable validated snapshot plus SHA-256 digest. It reports
identity/payload conflicts and skipped/identical records in dry-run, rejects any
conflict atomically, supports restart through an idempotent migration receipt,
and invalidates active SQLite tokens. Exact source snapshot and projected target
hashes are retained. Pre-switch rollback removes only that migration's unchanged
rows and never deletes subsequent backend work. Imported review decisions are
preserved as receipts, never converted to proven claims or graph writes.

Compatibility requires tested Book identity/provenance/review/snapshot/fencing
contracts and an operator confirmation bound to verified migration evidence.
There is no environment-based switch or startup migration. If verification cannot
establish the required contracts, the gate remains closed.

Only synthetic data and disposable PostgreSQL schemas are used. Production
migration, push, merge, main and Cluster Grid changes are excluded.
