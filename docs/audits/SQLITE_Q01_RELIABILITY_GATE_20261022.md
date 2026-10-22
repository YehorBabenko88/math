# SQLite Q01 — independent reliability gate (2026-10-22)

Base commit: `6c969ab049206c4f7f8c7348ff2148a352abd5b2`.
Status: **Q01 OPEN / NO-GO**. This document is a proposed acceptance contract, not proof that the current implementation violates it.

## Supplied laboratory evidence (not independently reproduced)
- 300/300 concurrent first-open PASS
- stale exists BOTH_PASS
- commit race PASS
- 4500/5500 ms BOTH_PASS
- initializing 1000 ms PASS
- initializing 6500 ms EXPECTED_TIMEOUT

Do not promote these outcomes to production acceptance.

## P0 invariants
1. At most one valid lease owner per job at any logical instant.
2. Every lease acquisition increments a durable monotonic fencing epoch.
3. Completion requires a conditional atomic update matching job id, current state, lease owner and epoch; zero affected rows is a stale-writer rejection.
4. Crash before COMMIT leaves no partial mutation; crash after acknowledged COMMIT preserves committed state under the documented SQLite synchronous/journal configuration.
5. Recovery of expired leases is idempotent; retry cannot erase a committed result.
6. Initialization readiness is based on validated schema/state inside an appropriate transaction, not only filesystem existence.
7. A timeout is reported as timeout, never as successful initialization.

## P1 checks
- Identify and benchmark any full-table jobs rewrite vs indexed row update (10k/100k/1M jobs).
- Measure DatabaseSync lock scope with 1, 2, 4, 8, 16, 32 contenders; record p50/p95/p99, SQLITE_BUSY, WAL size and write amplification.
- Verify BEGIN IMMEDIATE transaction boundaries and busy_timeout behavior with two independent connections/processes.
- Check WAL checkpoint while readers and writers are active; run PRAGMA integrity_check and foreign_key_check.
- Export must read a consistent snapshot; import must validate schema, versions, provenance, duplicates and checksums before atomic commit.

## Regression matrix
| ID | Fault / scenario | Acceptance |
|---|---|---|
| Q01-01 | 300 concurrent first-open | All succeed, one valid schema, integrity_check=ok |
| Q01-02 | stale exists | No false-ready and no destructive reinit |
| Q01-03 | commit race | Atomic, serializable state transitions |
| Q01-04 | 4500/5500ms | BOTH_PASS in specified fixture |
| Q01-05 | initializing 1000ms | PASS |
| Q01-06 | initializing 6500ms | EXPECTED_TIMEOUT, no false PASS |
| Q01-07 | SIGKILL before COMMIT | No partial durable state |
| Q01-08 | SIGKILL after acknowledged COMMIT | Committed data survives |
| Q01-09 | two workers claim same job | Single current owner |
| Q01-10 | lease expires, new owner claims, old owner completes | Old completion rejected |
| Q01-11 | checkpoint during long reader | No corruption; bounded operational policy |
| Q01-12 | malformed/duplicate import | Entire import rejected or explicit deterministic conflict |
| Q01-13 | export concurrent with writes | Consistent snapshot |
| Q01-14 | 10k/100k/1M jobs | Report throughput, p95/p99 and bytes written |
| Q01-15 | DatabaseSync 1–32 contenders | Report contention and lock duration |
| Q01-16 | repeated import | Idempotent or explicit conflict |

## Evidence and gates
Every result must include exact commit SHA, test source hash, OS/runtime/SQLite version, journal_mode, synchronous, busy_timeout, seed, worker count, process logs, JUnit, JSONL, SHA256 manifest and database integrity outcome. SKIP/BLOCKED is not PASS. Synthetic PASS never becomes physical GO.

No merge, deployment or physical execution is authorized. Source changes require code-path verification and independent review.
