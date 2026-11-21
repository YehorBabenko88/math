# GPT-2 independent Q01 phase-2 error-boundary review

Base: PR64 exact HEAD `9094a68fe723e6618e6726f97d8a7df67a76d790`.
User-supplied tree `6deee700d374a821cf09b4a4ed0eeb915f965e1f` is not independently attested by this report.
Scope: only `tests/book-queue-detached-journal.test.mjs`. No queue implementation, production, PostgreSQL, or ADMINIT changes.

## Actual RED evidence

Original exact-source hosted PostgreSQL Integration run [40298775080](https://github.com/YehorBabenko88/math/actions/runs/40298775080), job 121491234907 (Node22/PG16), raw job log: eight phase-2 test failures with actual `Invalid queue state`, expected `Invalid queue directory`. The failing scenarios are symlink, hardlink, persistent detached journal, oversized replacement, access denial, detached primary DB, detached WAL, and detached SHM. The two phase-2 accepted cases (regular replacement and vanished/ENOENT journal) passed. Summary: 971 PASS, 8 FAIL, 1 SKIP; no unsafe `ok=true` for the eight rejected cases is established.

## Root cause

`openBookQueue` calls `checkFiles(path)` during initial directory validation and maps errors to `Invalid queue directory`. A later `transaction()` calls `checkFiles(path)` again and maps non-allowlisted errors to `Invalid queue state`. The deterministic helper injects at first or second lstat by phase. Phase 2 is the transaction boundary. Thus the old assertion incorrectly required the outer directory error for a transaction-time refusal.

## Correction

The eight negative scenarios retain `r.ok===false`, link/stat/revalidation checks, and precise phase-specific error assertions: phase 1 `Invalid queue directory`, phase 2 `Invalid queue state`. No broad acceptance of both errors, no catch suppression, no weakening of file checks. Accepted ENOENT and regular replacement retain integrity and row-count checks.

## Execution status

Executed in isolated local Node22.16.0: two synthetic model tests of the two catch boundaries, 2 PASS/0 FAIL; independent old-expectation RED and phase-aware expectation GREEN on the observed error strings. These are pure models, not execution of the complete repository fixture. Actual full target regression on the proposed HEAD: NOT RUN; exact-head CI: PENDING until independently checked. No full npm test, existing PostgreSQL, ADMINIT, or physical/production action.

Q01 OPEN; physical G1 BLOCKED; Book gate CLOSED; Production NO-GO. Do not merge without exact-head 4-cell detached-journal evidence and independent reviewer acceptance.
