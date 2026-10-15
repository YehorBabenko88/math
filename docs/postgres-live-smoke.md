# Real PostgreSQL integration smoke test

The regular GitHub Actions suites do **not** exercise a live PostgreSQL database. The opt-in `tests/postgres-live.test.mjs` is skipped unless `MATH_UNIVERSE_TEST_DATABASE_URL` is set.

## Run locally (Windows PowerShell)

1. Create a **disposable dedicated database** on the standalone Math Universe machine. Do not use a Grid database, production database, or a database with any `mu_*` tables.
2. Install `pg` locally (`npm install pg`) and review/commit the dependency lockfile separately before deploying as a Windows service.
3. Supply `MATH_UNIVERSE_TEST_DATABASE_URL` securely through your local process environment. Never commit it or paste credentials into CI logs.
4. Run `node --test tests/postgres-live.test.mjs`.
5. Check that migration reapplication is a no-op, idempotent enqueue returns the same job, concurrent workers do not double-claim, renewal requires ownership, and an expired lease can be reclaimed.
6. Destroy the disposable test database manually when done.

**Important:** This test writes schema objects and job records; it does not automatically clean them up. It refuses databases already containing `mu_*` tables. It must never run against production.

## Pending qualification

The test is not proof of service restart or Windows recovery. Remaining work includes pinned `pg` dependency, CI PostgreSQL service testing, robust cancellation/timeouts, least-privilege Windows service packaging, and a controlled stop/restart drill.
