# Real PostgreSQL integration smoke test

The regular Node suite skips live PostgreSQL tests unless `MATH_UNIVERSE_TEST_DATABASE_URL` is set. The separate PostgreSQL Integration workflow supplies an isolated PostgreSQL service and runs the live smoke, fencing and checkpoint tests concurrently.

## Run locally (Windows PowerShell)

1. Create a **disposable dedicated database** on the standalone Math Universe machine. Do not use a Grid database, production database, or a database with any `mu_*` tables.
2. Install `pg` locally (`npm install pg`) and review/commit the dependency lockfile separately before deploying as a Windows service.
3. Supply `MATH_UNIVERSE_TEST_DATABASE_URL` securely through your local process environment. Never commit it or paste credentials into CI logs.
4. Run `node --test --test-concurrency=3 tests/postgres-live.test.mjs tests/postgres-fencing-live.test.mjs tests/postgres-checkpoint-live.test.mjs`.
5. Check that migration reapplication is a no-op, idempotent enqueue returns the same job, concurrent workers do not double-claim, renewal requires ownership, and an expired lease can be reclaimed.
6. Destroy the disposable test database manually when done.

**Important:** These tests write schema objects and job records inside random private schemas and drop only their own schemas afterward. This isolates concurrent files and processes. They must still never run against production. Do not use a Grid database.

## Pending qualification

The checkpoint test kills a synthetic worker process and verifies committed state after recovery; it is not proof of full production service restart. Remaining work includes deployment dependency locking, least-privilege Windows service packaging and a controlled stop/restart drill. See [joint integration audit](book-postgres-integration.md).
