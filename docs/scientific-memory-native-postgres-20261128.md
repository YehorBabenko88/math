# Scientific Memory native PostgreSQL qualification — 2026-11-28

Integrated the existing canonical P store from `origin/math-universe/r17-p-root-authority`: `python/scientific_memory.py`, `python/scientific_memory.sql` and its three test files. No second store, migration ledger or HTTP service was introduced. The historical record identity and canonical JSON remain unchanged. Optional root authority fields admit only literal Python `False`; provenance requires both literal `False`. Rehashed true, 0, strings and missing nested authority claims fail before SQL. Qualified reads retain negative trust dimensions; a reproduced descriptive claim is not execution or trading authority.

Added a PostgreSQL statement trigger rejecting UPDATE, DELETE and TRUNCATE (SQLSTATE 55000). Exact replay remains SELECT-only; conflicting first inserts reconcile against canonical bytes. Database owners/superusers remain trusted administrators able to alter DDL. The trigger is an application history guard, not a cryptographic defense against a hostile database administrator. P schema remains a separate explicit installation outside the historical Math migration ledger.

Verification used native Windows PostgreSQL 18.1 from `C:\Program Files\PostgreSQL\18\bin`, psycopg 3.3.6. No existing database or service was contacted. All clusters were newly initialized below this task's `work` directory, loopback-only on OS-selected free ports, with no Windows service registration. Local trust authentication applies only to these disposable clusters.

Commands:

```powershell
python -m unittest discover -s tests -p 'test_scientific_memory*.py'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qualify-scientific-memory-postgres.ps1
```

Results: 25 unit tests passed. The live test first failed as expected because UPDATE was admitted; after installing the trigger it passed. The final harness ran two native live passes, before and after immediate server termination and WAL recovery. Each pass tests actual schema installation, identical positive/negative descriptive records, reconnect persistence, exact deduplication, UPDATE/DELETE/TRUNCATE rejection, 24 concurrent first inserts over eight connections yielding one row, and rollback of a save nested in a caller transaction. The harness also performs pg_dump custom-format backup and pg_restore into a fresh database, compares every id/symbol/payload/stored_at tuple, and verifies the restored mutation guard. Last completed disposable harness evidence: `../scientific-memory-pg-5d2ace28a5214126af49e9147671e400/server.log` and `memory.dump`; its server was stopped in finally.

A separate fresh cluster `../pg-memory-lab/data` was shared only with the experiment agent at port 54115; `math_experiment_test` and two LOGIN roles were created exclusively there at parent request. Its lifecycle is coordinated with that agent.

Limits: this is native isolated component evidence, not protected integrated infrastructure, service deployment, production admission, a soak test, hardware acceptance, a Bybit source authenticity receipt, or formal scientific proof. Authority rejection unit tests use a recording connection to demonstrate rejection before any SQL; persistence, deduplication, concurrency, transactions and recovery use actual PostgreSQL. Qualification makes no claim that arbitrary direct superuser SQL can be safely trusted. The harness retains its disposable files for inspection and never recursively deletes a computed path.
