# PR #3 independent integration audit — 2026-10-16

Scope: `feat/book-postgres-integration-test`, starting at
`02a233294b78c6b0dc0bf9b81659ff86f81bdd27`. Changes are local; no publication,
merge, main changes or Cluster Grid changes were performed.

## Confirmed regressions and corrections

Every implementation correction followed a failing regression test.

* Fenced completion used unrestricted `JSON.stringify`. Result and checkpoint now
  share descriptor-only, inert object validation, a 256 KiB escaped UTF-8 JSON
  budget, depth 24 and 20,000-node limits. Getters, hooks, proxies, custom
  prototypes, invalid values, cycles and sparse arrays are rejected before SQL.
* Conditional writes now distinguish lost ownership (`JOB_LEASE_LOST`) from
  actual database errors, which retain their original identity. Claims exclude
  IDs outside JavaScript's positive safe-integer range before mutating rows,
  including exhausted-lease cleanup. Larger IDs require a future API extension;
  they are left untouched, not rounded or claimed without a usable owner.
* Worker checkpoint/complete lease rejection now aborts its signal and prevents
  a subsequent stale failure transition. It drains pending checkpoint writes
  and renewals before terminal writes, rechecks cancellation before queued
  checkpoint calls, closes the signal on success, and contains throwing or
  rejecting error observers. Strict subprocess tests exercise ignored rejected
  promises. Terminal writes remain conditional on the authoritative SQL fence.
* Migration boundary regexes were replaced by lexical scanning of trusted SQL.
  Nested comments, quoted literals/identifiers and dollar-quoted function bodies
  are preserved. Additional top-level transaction controls are rejected. Exactly
  one leading BOM is removed: real PostgreSQL rejected the otherwise preserved
  BOM with SQLSTATE 42601, a defect not caught by mocked database tests.
* Failed rollback no longer masks the initiating migration error. The failed
  connection is discarded through `client.release(rollbackError)`.

## Verification

Final full-suite runs, with the native Python PDF backend and disposable local
PostgreSQL 18.1 enabled:

| Runtime | Tests | Passed | Failed / skipped / cancelled |
| --- | ---: | ---: | ---: |
| Node 22.23.3 | 258 | 258 | 0 / 0 / 0 |
| Node 24.20.0 | 258 | 258 | 0 / 0 / 0 |

Command: `node --test --test-concurrency=4 tests/*.test.mjs`, using each runtime.
The four live PostgreSQL files contain eight tests. They additionally passed
concurrently in two independent Node 22/24 processes (8/8 each), each using
unique temporary schemas. The temporary server was stopped after every run.

Real-database coverage includes process kill after checkpoint commit, reclaimed
jobs, concurrent claims, all stale mutations, exhausted retries, result/provenance
round trips, checkpoint resume, legacy API compatibility, concurrent and repeated
migrations, atomic DDL rollback, nested SQL comments, function bodies and BOMs.
The PostgreSQL workflow includes the new live audit file for future CI runs.
GitHub Actions have not run for these unpublished local commits.

Raw logs are retained outside the worktree under `outputs/pr3-audit-node22.txt`,
`outputs/pr3-audit-node24.txt` and `outputs/pr3-audit-parallel{22,24}.txt`.

## Compatibility and remaining limits

Book SQLite and generic PostgreSQL remain distinct opt-in APIs. The existing
compatibility tests still require `compatible=false` and
`fullBookstoreSubstitution=false`. Identity migration, review persistence and
snapshot mapping remain prerequisites for any future backend bridge. No schema
migration was added or historical migration rewritten.

Source/version/page provenance, external-processing permission and mandatory
human review remain preserved. Completing a queue job grants no scientific
approval and does not import knowledge into the graph. No real reference books
were available; PDF tests use synthetic fixtures.

Handlers must honor AbortSignal; an already executing handler or database query
cannot be forcibly cancelled by this worker. A slow terminal query may safely
lose its lease and be rejected. Concurrent checkpoints can commit out of order;
handlers requiring ordered stages must await each save. Pre-write checkpoint
validation errors remain recoverable by the handler; actual checkpoint write
errors latch failure. Error-observer failures are contained, not persisted.

Migration scanning is for trusted repository scripts, not arbitrary SQL. Dynamic
SQL/procedure transaction control and unquoted SQL `BEGIN ATOMIC` function bodies
are not supported. Local database validation used PostgreSQL 18.1; the workflow's
PostgreSQL 16 execution remains pending publication. Browser tests were not rerun
because this audit changes no browser-facing code.
