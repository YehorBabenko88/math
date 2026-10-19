# F02: Windows release source association

Scope: branch `fix/windows-release-artifact-binding`, based exclusively on
`f1c29893d5826bdb2bfd24def2ee54a4377a9b8e`. No F01 changes are integrated.

## Change and guarantees

`Assert-DeploymentRelease` in `scripts/windows-deployment.ps1` checks a candidate
without executing its code. `scripts/windows-update.ps1` invokes it before the
candidate test runner, then again inside the forward candidate pointer callback,
immediately before `Write-DeploymentPointer`. The rollback pointer callback skips
candidate verification, preserving recovery when candidate source is invalid.

The helper requires an absolute canonical Windows path (case and slash spelling
are equivalent), rejects lexical dot-segment aliases and reparse-point ancestors,
and requires a linked worktree registered with the expected repository's exact
Git common directory. The target must be its own Git top level and its HEAD must
be the exact candidate SHA. Ordinary directories, another repository's worktrees,
and wrong HEADs fail closed. Spaces, apostrophes and brackets in custom roots
remain supported. Unsupported tracked names/modes fail closed; tracked symlinks
and submodules are deliberately unsupported.

The staged index must match the candidate. Every tracked regular file is read
and hashed as a Git blob independently of index stat caching, assume-unchanged,
and skip-worktree flags. This covers the test runner as well as source. Missing,
changed or substituted tracked files fail. Raw bytes are compared first. Only
strict UTF-8, NUL-free, uniformly CRLF text may additionally match its LF Git blob,
when committed text/eol attributes and trusted repository autocrlf policy permit
that checkout conversion. No source bytes are written or normalized. Git filters,
textconv and hooks are not invoked; fsmonitor and replacement objects are disabled
for these read-only commands. An unset autocrlf setting defaults to false.

Filesystem enumeration rejects unexpected untracked source, including ignored
files, and reparse points encountered in the source traversal. The explicitly
mutable generated areas are root `node_modules`, root `test-results`, and Python
`__pycache__` directories. Their contents are not attested or recursively inspected;
their boundary directories themselves cannot be reparse points. Tracked files
inside these areas still receive the tracked-file checks.

The exact-SHA/current-attempt GitHub checks, updater lock, custom Root launcher,
atomic pointer replacement and rollback architecture remain in place.

## Evidence and qualification limits

Synthetic Git repositories and temporary filesystem fixtures only were used for
deployment-contract execution. No updater, NSSM, install, service, real release
activation, production database, gate, deployment or cutover action was run.

The first new helper regression run against the unmodified implementation had
32 tests, 30 passing and 2 failing because the helper did not exist. Negative
fixtures in that first run also caught that missing-command exception; they alone
are not independent evidence of each old acceptance path. A separately retained
external probe subsequently replays only the immutable baseline's target/test
block and confirms acceptance of seven cases: ordinary directory, wrong HEAD,
dirty tracked source, altered assume-unchanged runner, lexical path alias,
junction, and existing-directory reuse. The probe runs harmless synthetic Node
scripts and excludes all installation/activation/service code. External evidence:
`outputs/artifact-red-boundary.ps1`, `.log`, and `artifact-red-summary.log`.

Final local checks (complete inventories, no exclusions or test-name filters):

| Check | Result |
| --- | --- |
| Node 22.23.3 / PostgreSQL 16 | 401 passed; zero failed/cancelled/skipped/todo |
| Node 22.23.3 / PostgreSQL 18 | 401 passed; zero failed/cancelled/skipped/todo |
| Node 24.20.0 / PostgreSQL 16 | 401 passed; zero failed/cancelled/skipped/todo |
| Node 24.20.0 / PostgreSQL 18 | 401 passed; zero failed/cancelled/skipped/todo |
| Native PDF profile | 76 passed; zero skips |
| Chromium browser profile | 14 passed; zero retries |
| Local pwsh / Pester 4.10.1 | 39 passed; zero failed/skipped/pending/inconclusive |

Logs are external `outputs/artifact-node{22,24}-pg{16,18}.log`,
`artifact-native-pdf.log`, `artifact-browser.log`, and `artifact-pester.log`.
The Pester fixtures also execute the actual isolated candidate test block with a
harmless tracked runner that changes source, then verify the second source check
rejects the candidate. Git tree mode 120000 is tested with materialized text rather
than requiring Windows symlink privileges; junction and submodule modes are also
covered without network or service operations. Both PowerShell 5.1 and pwsh
remain required by the existing Windows CI matrix. Local PS5 execution policy
blocks Pester; it was not bypassed or changed. Exact final-HEAD CI status must be
read from GitHub, independently of these local results.

The browser's first local run failed from duplicated local Playwright packages
created during dependency copying. The exact duplicate directory in this worktree
was reversibly moved to an owned temporary directory; the subsequent full browser
run passed. No dependency lock or immutable package claim follows from that fix.

## Explicit remaining conditions

This is source association under the existing trusted local repository/Git/runtime
and cooperating-updater model. It does not defend against a hostile administrator,
modified Git executable/configuration, object-store tampering, hard-link writers,
or manual concurrent writes between file reads/check completion and process use.
The updater lock serializes cooperating updaters, not arbitrary writers. There is
no atomic filesystem snapshot or process/runtime attestation. Mutable dependency
and generated-cache bytes remain a separate trust boundary. Existing active
release early-return and CheckOnly paths do not run candidate code or activate a
new candidate; this change does not requalify an already running process.

F03 / R06 remains open: canonical source association modulo an allowed checkout
EOL conversion does not establish identical raw SQL bytes across machines. No
SQL, migration ledger, applied checksum or historical bytes were rewritten,
normalized or automatically adopted. Existing historical ledgers require an
explicit compatibility plan. Immutable npm/Python/transitive dependencies,
Pester downloads and action references remain separate release-artifact work.
Green tests do not qualify real host install/reboot/rollback/HTTP release identity,
production authorization, Book gate opening, branch protection or deployment.

A real own-branch worktree smoke also exercised the complete tracked tree and
allowed dependency layout. It first rejected mixed LF/CRLF bytes left by local
editing even though Git's content diff was clean. Only the three newly changed
report/helper/test files were re-materialized from their committed Git contents;
no SQL files were touched. The complete source association then passed. This
strict checkout-policy rejection is deliberate; mixed-EOL release files require
a fresh canonical checkout rather than automatic source/ledger normalization.

The first exact-head Windows CI run (39320758368) passed all 39 pwsh tests but
failed two PS5 fixture-construction steps: New-Item treated bracketed junction
targets as wildcard paths. The test utility now escapes targets only on PS5;
all junction/source assertions remain. A normal native PS5 inline filesystem
probe confirmed escaped-target construction works, without importing blocked
Pester, changing policy, or running service/updater actions. Final CI must use
the subsequent exact HEAD; the earlier failed run is retained as evidence.
