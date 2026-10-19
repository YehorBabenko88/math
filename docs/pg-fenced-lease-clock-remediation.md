# F01 fenced PostgreSQL lease-clock remediation

Date: 2026-10-19. Scope: independent branch `fix/pg-fenced-lease-clock` only.

Audited starting commit: `f1c29893d5826bdb2bfd24def2ee54a4377a9b8e`.
Implementation commit: `d940893cafe1e6867e9530af9eaa495e67ab1bf5`.
Verified source SHA: `3f8efb8b68c552ad9f2a330987983e3ca580160a` (adds an actual database lock-queue witness to the upgrade regression). The following report commit changes documentation only. Exact final published HEAD and its Actions run URLs are reported separately at handoff to avoid a self-referential report/commit cycle.

## Finding and correction

The original fenced store began its transaction before the protocol advisory lock and used PostgreSQL `now()` for all lease decisions. That clock is fixed at transaction start. A completion, renewal, checkpoint, failure or acquisition that waited behind another transaction could therefore use pre-wait time. In particular an already expired owner could complete successfully, or acquisition could return a deadline already in the past.

`src/ingestion-job-postgres-fenced.mjs` now uses database `clock_timestamp()`. Renew/checkpoint/complete/fail explicitly take the target job row `FOR UPDATE` after the protocol advisory lock and before the DML predicate checks owner, token, state and strict expiry. This prevents a predicate evaluated before row-lock contention from authorizing a later expired mutation. Claim retains `FOR UPDATE SKIP LOCKED`, safe-integer ID bounds and per-acquisition UUIDs; it computes the lease deadline after candidate locking. Same-worker reacquisition still changes the token, and completion remains at most once.

Additive `sql/006_ingestion_lease_clock.sql` replaces the SQL005 guard while leaving all historical SQL bytes untouched. It first takes exclusive protocol advisory lock `(732814,3)` to drain transactions executing the old guard, inside the runner's checksummed migration transaction. The replacement samples `checked_at` only after its protocol row `FOR SHARE` lock. It checks `OLD.lease_until > checked_at` and requires a new running lease deadline to remain strictly future. Expiry at or before the check rejects. Direct SQL cannot rely on an earlier transaction clock to bypass the guard. The dedicated expiry SQLSTATE `MU001` is translated to the existing public `JOB_LEASE_LOST`; other database errors propagate unchanged.

SQL006 preserves existing legacy/fenced mode, function identity/security-definer behavior and schema-pinned search path, and retains revoked PUBLIC execution. The generic runner appends the exact filename to its strict manifest, records the same raw-UTF8 checksum contract, validates every historical prefix/hash on replay, and never adopts unverified filename-only history. Startup still does not migrate or activate the protocol. Existing legacy producers and legacy service semantics are preserved; default legacy mode is deliberately unfenced. No Book backend, gate, deployment or Windows updater change is included.

## RED/GREEN evidence

All retained logs are outside Git under the wrapper directory's `outputs/clock-*` paths. No original audit report or probe was edited.

Before implementation, the new live test used public ten-second claims, held the protocol lock eleven seconds, then repeated with job row locks. PG16 and PG18 both failed the expected-denial assertions (`clock-red-pg16.log`, `clock-red-pg18.log`). The PG18 log records every result: complete, renew, checkpoint and fail succeeded after expiry for both lock types; delayed acquisition returned an already expired deadline. The PG16 log retains the first failing completion assertion for both lock types. These failures were observed before production edits.

The committed regression `tests/postgres-lease-clock-live.test.mjs` covers all four mutations after protocol advisory, job-row and protocol-row waits; pending acquisition freshness; SKIP LOCKED behavior; concurrent same-worker reacquisition; rejection of the old token; and exactly one successful completion when two completions race. A separate direct-SQL test sets `lease_until=now()` in its owned legacy fixture transaction, verifies exact database equality, then exercises the fenced guard in that same transaction. It asserts `MU001` independently of the store and rolls the synthetic mode change back. No local-clock timestamp rounding is used.

For normal parallel CI, valid capabilities shorten only owned fixture leases to a future 500ms deadline and the lock holds last 750ms. This avoids eleven-second global advisory holds interfering with other suites. The genuine public-minimum-ten-second reproductions remain in the retained external RED logs and original-probe GREEN log. Existing same-worker tests that previously forced an immediately expired new lease were adapted to shorten a still-valid future lease and wait for database-confirmed expiry; their stale-owner/scientific assertions remain intact.

`tests/postgres-migration-integrity-live.test.mjs` executes exact SQL001–005 bytes and records their hashes in the same fixture transaction, then upgrades only SQL006. It verifies both legacy and already-fenced modes, unchanged historical rows/hashes, guard privilege/search-path properties, SQL006 content drift rejection and malformed hash-contract rejection. The upgrade barrier had its own RED result (`clock-red-upgrade-barrier.log`): without the new exclusive lock the upgrade completed while an old writer held a shared protocol lock. The final test requires a real ungranted exclusive advisory lock in `pg_locks` for the migration backend PID; a fixed delay alone is not accepted as evidence.

Exact manifest-count assertions were updated from five generic migrations to six, including migration crash/rollback/lexer fixtures. They were not replaced by permissive counts or exclusions. Book still has its original five migrations.

## Fresh local qualification

All final-source checks below ran against `3f8efb8b68c552ad9f2a330987983e3ca580160a`. The full command was `node scripts/test-full-ci.mjs` (Node22 used its absolute sibling binary); the inventory was **82 files**, no test filters/exclusions. `BOOK_INGESTION_PYTHON` was the absolute sibling `work/book-python/Scripts/python.exe`. Databases were disposable loopback `math_test` databases on PG16 port55440 and PG18 port55439, with owned UUID schemas only. Neither cluster nor other schemas were removed.

| Check | Result | External log |
| --- | --- | --- |
| Node24 × PG16 full unfiltered suite | 407/407; zero fail/cancel/skip/todo | `clock-node24-pg16.log` |
| Node24 × PG18 full unfiltered suite | 407/407; zero fail/cancel/skip/todo | `clock-node24-pg18.log` |
| Node22 × PG16 full unfiltered suite | 407/407; zero fail/cancel/skip/todo | `clock-node22-pg16.log` |
| Node22 × PG18 full unfiltered suite | 407/407; zero fail/cancel/skip/todo | `clock-node22-pg18.log` |
| Native PDF workflow profile | 76/76; zero skips | `clock-native-pdf.log` |
| Browser Chromium, own port4179 | 14/14; no retries | `clock-browser.log` |
| WindowsContracts, normal pwsh, Pester4.10.1 | 24/24; zero skipped/pending/inconclusive | `clock-pester.log` |
| Original ten-second/eleven-second audit probe, PG16+PG18 | 2/2 expired completions denied with JOB_LEASE_LOST; state running | `clock-original-probe-green.log` |
| Historical raw-file comparison | All ten generic001–005 and Book001–005 files byte-identical to exact base checkout | `clock-historical-bytes.log` |

The first exploratory full run exposed two deliberately incompatible expired-new-lease fixtures and two stale generic migration-count assertions. Those were corrected as described above. No filtered replacement or retry policy was introduced. Final four-cell runs above passed in full. Local Windows PowerShell5 execution was already blocked by host policy; no policy bypass/change was attempted. Both Windows shell jobs must be checked on the exact final remote HEAD. Actions is separate Linux/Windows qualification, not a claim of production behavior.

## F03 / inherited R06 remain open

This correction does not establish a portable immutable SQL/dependency release. The runner intentionally hashes raw working-file UTF-8 bytes, not normalized SQL. Git autocrlf can give identical Git source SHAs different on-disk SQL hashes; replay correctly fails closed. No `.gitattributes` policy, newline normalization, historical hash backfill, hash adoption flag, or filename-only history conversion was added.

The new SQL006 itself has this inherited representation distinction in this Windows checkout: raw SHA256 `7e6db3cd893da35cf090c439b430b5094113b1caba85bdddf7712f160940b6e3` (41 CRLF), versus Git LF blob SHA256 `aacbdc6e4fe8145b08e904ee2e73996c7b3a2b39452a7e72bc0ed5ab8693b70d` (zero CRLF). These are evidence only, not alternative accepted historical hashes. An existing ledger established from a different representation continues to reject current mismatched bytes and requires a separately reviewed historical-byte compatibility plan.

No npm lockfile or complete hash-pinned Python/transitive dependency artifact is supplied by this branch. Runtime Pester downloads and tag-based action references remain inherited qualifications. Green cross-platform CI does not close F03/R06, prove reproducible dependency resolution, or authorize normalization of already-applied migrations.

## Acceptance limits

The operation's authority is checked under the locks at database wall time. Commit, network delivery or scheduler delay can follow later; a returned lease record remains a snapshot and does not promise future ownership. This uses PostgreSQL wall time and does not qualify host-clock jumps or a monotonic-time design.

A SQL004-only standalone store remains API-compatible. A SQL005-only database retains the old direct-SQL trigger behavior; changing the JavaScript store alone does not qualify old writers or direct SQL. SQL006 plus the corrected store is the reviewed expiry contract. Database owner/superuser and authorized capability holders remain trust roots. Installing SQL006 is an explicit administrative migration, never a startup side effect.

This branch addresses F01 only. F02 updater artifact binding, R04 branch governance, F03/R06 release reproducibility, R09 provider/science scope and R11 native parser isolation remain separate. No other remediation branch was integrated; no PR was created/edited, no merge/rebase/force-push occurred, and no main/settings/Cluster Grid/production/gate/deployment operation was performed. Local/CI results are synthetic qualification, not production approval or permission to open the Book gate.
