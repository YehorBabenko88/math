# F01/F02 D01/D02 audit hardening

Date: 2026-10-20. Branch: `fix/f01-f02-audit-hardening`.
Base: `233c36b81b37f18a3c1e2813daadc9aca3158267`.
Tested implementation: `51f66aa909fdbf1d51210464cb17caf2c73af439`.
Delivery HEAD is this report's Git commit (`git rev-parse HEAD`); the final handoff
provides its exact SHA and SHA-bound Actions URLs. A report cannot embed its own
Git object hash. Only documentation, tests and this report change.

## D01 (P3): contradictory clock documentation resolved

`docs/postgres-ingestion-checkpoints.md` now distinguishes deliberately unfenced
legacy behavior, SQL004 standalone compatibility, SQL005-only transaction-clock
guard limitations, and the corrected SQL006 plus fenced-store combination.
Ownership is checked against current PostgreSQL wall-clock after applicable locks,
including the trigger's protocol-row lock. Migrations and administrative protocol
activation are explicit separate operations; startup performs neither.

SQL001–006, Book SQL001–005 and historical checksums were not changed. All eleven
SQL files were compared byte-for-byte with the exact base. Commit: `3add003`.

## D02 (P3): server-side lock-wait evidence added

`tests/postgres-lease-clock-live.test.mjs` reserves dedicated clients and records
their backend PIDs. Every complete, renew, checkpoint and fail operation, across
advisory, job-row and protocol-row scenarios, must satisfy these checks before
the blocker commits:

1. Its backend appears in `pg_stat_activity`, is active and has
   `wait_event_type = 'Lock'`.
2. `pg_blocking_pids(pid)` identifies the actual fixture blocker.
3. Its own lease is still valid according to DB wall-clock while it is already
   waiting. Deadlines are not modified after dispatch.
4. Every deadline has expired according to DB wall-clock before unlocking.

The fifth advisory claim also proves actual waiting, and `pg_locks` must show the
expected ungranted advisory lock `(732814, 3)` for each backend. The fresh claim
deadline assertion remains. Row/protocol-row waits can be transaction-ID waits;
the test checks actual blocker identity rather than assuming a tuple wait type.
The blocker explicitly holds the corresponding job rows or protocol row.

Bounded observation clears the statistics snapshot and queries actual DB state.
Polling does not retry operations or substitute elapsed delay for lock evidence.
Missing or late evidence fails closed. All original JOB_LEASE_LOST, unchanged
job state, stale-token, single reacquisition, single completion and MU001
assertions remain. No test filters, retries, runner timeouts or runtime changes
were introduced. Each case uses its own disposable UUID schema.

A new negative witness test rejects expired-at-observation, unrelated-blocker,
non-waiting and idle samples. An external mutation control removing the valid-lease
assertion fails with `Missing expected exception`; the real helper rejects the
same expired sample. The initial instrumentation RED exposed absent PID tracking;
this is a coverage gap, not evidence of a newly found runtime bypass.

## Precision boundary discovered during qualification

The initial Node24/PG18 run passed 407/408 tests. The original strict JS
`witness > lease_until` assertion failed after PostgreSQL had confirmed expiry.
A deterministic live regression proves the cause: timestamps 800 microseconds
apart compare differently in SQL but map to equal millisecond-resolution JS Date
values. The final test requires a DB-clock margin greater than 1 ms before unlock,
preserving the original strict JS assertion. No deadline rounding, fixed sleep,
assertion weakening or runtime modification was used.

Implementation commit: `51f66aa909fdbf1d51210464cb17caf2c73af439`.

## Verification

All 82 `tests/*.test.mjs` files ran unfiltered through
`node scripts/test-full-ci.mjs`, with test concurrency 4. The inventory includes
generic and Book migrations, cutover, WAL, signed sessions, backup, journal,
fencing, routing and source identity contracts.

| Node | PostgreSQL | Passed | Failed / cancelled / skipped / todo |
| --- | --- | ---: | --- |
| 22.23.3 | 16.15 | 409 | 0 / 0 / 0 / 0 |
| 22.23.3 | 18.1 | 409 | 0 / 0 / 0 / 0 |
| 24.20.0 | 16.15 | 409 | 0 / 0 / 0 / 0 |
| 24.20.0 | 18.1 | 409 | 0 / 0 / 0 / 0 |

| Additional check | Observed result |
| --- | --- |
| Native PDF with actual Python dependencies | 76/76, no skips |
| Browser E2E, one worker and zero retries | 14/14 |
| Local Windows pwsh, Pester 4.10.1 synthetic fixtures | 39/39, no skips |
| Local Windows PowerShell 5 Pester import | Blocked by existing AuthorizationManager file validation; settings unchanged |
| Original public ten-second F01 lease/advisory-wait probe, PG16/18 | JOB_LEASE_LOST; job remains running; 0/2 expired completions |
| SQL005 to SQL006 prepared old-transaction upgrade probe, PG16/18 | Transaction-clock predicate valid but wall-clock expired; direct SQL denied MU001 |
| Original F02 ordinary SHA-named directory | Rejected before runner execution; no activation code invoked |
| F02 hidden tracked-runner modification and ignored executable source | Both rejected despite clean Git status |
| Historical SQL raw bytes vs exact base | Eleven identical files |
| Cumulative `git diff 233c36b..HEAD --check` | Passed |

Local logs remain outside Git under the parent workspace's `outputs/`:
`hardening-final-node{22,24}-pg{16,18}.log`, `hardening-pdf.log`,
`hardening-browser.log`, `hardening-pester.log`, `hardening-windowsps-policy.log`,
`hardening-original-f01.log`, `hardening-upgrade.log`, `hardening-f02.log`, and
`hardening-f02-extra.log`. The mutation control is recorded in
`hardening-witness-red.log`; its original and actual-helper harnesses are
`hardening-witness-{red,green}.mjs`. The initial failed precision run is retained
in `hardening-node24-pg18.log`.

The unchanged push workflows run the four PostgreSQL cells, Native PDF, Browser,
validation and both Windows shell profiles. The final handoff lists successful
Actions bound to the exact final SHA, not an earlier success. Local PS5 success
is not claimed; no execution-policy bypass was attempted. Branch runs are at
[GitHub Actions](https://github.com/YehorBabenko88/math/actions?query=branch%3Afix%2Ff01-f02-audit-hardening).

The initial report write failed due to the local Python default encoding and
produced an empty report commit. This UTF-8 report corrects it in a subsequent
ordinary commit; no history rewrite or force-push was used.

## Limits and decision

No new P0/P1/P2 runtime defect was confirmed in this scoped hardening. This does
not certify unrelated behavior or replace the earlier independent audit. Valid
public ten-second claims are shortened only in synthetic owned fixture rows to
two seconds; the original public-ten-second probe was separately repeated.
A badly delayed server can intentionally fail the valid-wait witness; the test
never accepts an already expired request as proof of waiting across expiry.

F03/R06 remain: raw SQL EOL/checksum reproducibility, immutable dependency artifacts
and unverified historical ledgers are neither repaired nor silently adopted.
R04 governance, R09 provider coverage and R11 native PDF process isolation remain
outside scope. Database wall-clock synchronization and privileged-owner threats
remain operational assumptions. Tests do not prove OS-level worker termination
or a real production deployment.

Book production gate, routing, worker startup, production data and permissions
are unchanged. There was no deployment, service restart, production migration,
cutover, merge, PR update or repository-setting change. Tests used disposable
local PostgreSQL processes and synthetic fixtures only. Owned test servers are
stopped after local qualification.

**GO for independent review of D01/D02**, contingent on successful final-SHA
Actions. **NO-GO for production deployment/cutover**; production gate stays closed.
No PR is created or updated.

Normal publication, only this new branch:

```powershell
git -C '<worktree>' push origin HEAD:refs/heads/fix/f01-f02-audit-hardening
```
