# F03/R06 Remediation Report — PR #12 findings F01–F05

Date: 2026-10-22 (Europe/Berlin). Repository: YehorBabenko88/math.

- Branch: `fix/f03-r06-independent-audit-findings`.
- Exact base: `2ecbfd9fb050d5e863122f2a47817ab1ac69e1f4` (`integration/math-f03-r06`).
- Implementation SHA: `f90ac4d6c5e832fc0332ca508f4daa25d0599dcb`.
- Worktree: `C:/Users/Administrator/Documents/Codex/2026-10-14/https-github-com-yehorbabenko88-math-actions/work/fix-f03-r06-independent-audit-findings`.
- Original independent audit: wrapper `outputs/F03_R06_FINAL_INDEPENDENT_AUDIT.md`.
- Full local evidence: `C:/Users/Administrator/Documents/Codex/2026-10-14/https-github-com-yehorbabenko88-math-actions/outputs/pr12-remediation`; focused RED/GREEN logs also under worktree `outputs/remediation-f01` through `remediation-f04-f05`.

**Decision: F01–F05 remediation ready for independent review, but code integration remains NO-GO because the separately reproduced SQLite first-open runtime failure remains unresolved. Production NO-GO. Book gate CLOSED.** Green CI does not waive this finding. No PR was created or updated, and no deployment/cutover was attempted.

## Scope and RED/GREEN

All five original findings were reproduced before production code changes. A targeted failing assertion is distinguished from a rejecting control; a successful later run does not erase an earlier failure. No excluded tests, weakened assertions or automatic test retries were introduced.

| Finding | RED before correction | Correction and GREEN evidence |
|---|---|---|
| F01 / P1 | Official digest-verified ZIP extracted over prepopulated `Functions/*.ps1`; harmless marker executed on import. | Existing destination refused; fresh extraction; complete file/directory inventory and hashes checked against approved ZIP; reparse paths refused. Clean import succeeds; executable extra script is rejected before import and marker stays absent. Both shell profiles pass. |
| F02 / P2 | Seven false-acceptance regressions among nine initial cases; two existing rejecting controls. Separate parent-junction controls also failed. | Every reference read uses `--no-replace-objects`; exact 11 SQL paths, mode100644 blobs, complete index/HEAD equality and raw bytes required. Blob/tree replacements, symlink/gitlink/mode/set changes, staged drift and linked parents covered. Focused 13/13 pass. |
| F03 / P2 | Validator accepted override manifest; real offline npm clean-install planning rejected it. Two new assertions failed. | Fail-closed reviewed manifest-key allowlist and exact scripts reject overrides, workspaces, lifecycle scripts and unknown installation directives. Approved versions and lockfile untouched. Targeted 10/10, including actual npm offline dry-run controls, pass under Node22/24. |
| F04 / P2 | Changed tracked application source still qualified for unchanged commit. | New source verifier checks actual tracked bytes and index before/after tests, binds a receipt outside checkout to source/run/context and rejects missing/corrupted/stale receipts. Assumed-unchanged files are checked directly. Allowed Git CRLF text conversion is checked without rewriting files. |
| F05 / P3 | Missing repository/workflow/run/context and malformed values still qualified. | Repository/workflow/context allowlists; positive bounded numeric IDs; controls/unknown fields/cross-workflow context rejected before qualification. Producer/consumer regressions pass. |

F04 and F05 focused source/provenance tests pass, including corruption, wrong attempt, changed tracked files, staged drift, CRLF controls and malformed metadata. The release consumer now requires the pre/post evidence fields and compares the committed tree with repository-derived evidence.

## Implementation boundaries

`sourceSha` identifies the commit; `committedTreeSha` and `trackedSourceSha256` identify the checked tracked source. `testedWorktreeVerified` and `sourceEvidence=self-reported-pre-post-tracked-tree/v1` describe local pre/post checks. This is **self-reported evidence bound to GitHub archive metadata, not independent attestation**. Temporary modifications restored between checks or a malicious same-user process are outside that proof.

Generated untracked dependencies, results, bytecode and output manifests do not exempt tracked source from checking. Installed `node_modules`, npm configuration/environment, interpreters, browser binaries and runner images are not independently attested by a lockfile. The manifest policy intentionally requires review before allowing new manifest keys/scripts.

Pester is prepared before candidate JavaScript and its composition is reverified before import. File checks and ordering do not replace process/account isolation against same-user concurrent execution. The approved ZIP digest is unchanged. A local WinPS Get-FileHash autoload failure was observed; using internal .NET SHA256 removed that module-autoload dependency. It was not used as grounds to change system configuration.

SQL001–006 and Book001–005, historical ledgers/checksums, package.json, package-lock.json and Python requirements are unchanged from base. Staged SQL index drift is explicitly rejected. No normalization, historical hash adoption, backfill or production migration was performed. Further details: `docs/pr12-integrity-remediation.md`.

## Additional defects and test findings

### Q01 / P2 — unresolved SQLite first-open availability failure

Full-suite test `tests/book-ingestion-queue.test.mjs:68` (`independent processes deduplicate and acquire only one lease`) failed in the shared-database/high-concurrency local run: one child opening a fresh queue raised `Invalid queue state` from `src/book-ingestion/queue.mjs:75`.

A separate barrier-synchronized creator probe reproduced the failure **once in 300 pairs**. A subsequent instrumented 400-pair probe did not reproduce it. Native exec/prepare/statement wrappers did not capture the underlying error; exact cause remains unknown. An exclusive-lock control showed constructor success followed by SQLite BUSY, which did not justify a constructor-timeout patch. **No speculative queue implementation change or retry was added.**

Evidence: `outputs/remediation-f02/queue-race-probe.txt`, `queue-race-diagnostic.txt`, `sqlite-exclusive-control.mjs`; full failure in external `verified/node24-pg16.log`. This is a confirmed runtime failure, not a proven loss of data or stale completion. It blocks unconditional integration GO until independently diagnosed. A later passing isolated matrix does not resolve it.

### T01 / P2 — migration fixture global lock ordering corrected

An initial local matrix run failed because SQL006's backend never reached the expected protocol lock: another schema's migrator could own database-global mutex1 while waiting on protocol3, which the old fixture took too early. A deterministic interposed fixture produced RED for both legacy and fenced cases. The corrected test takes the old-writer lock only once its own migrator reaches SQL006 after mutex acquisition.

Independent review then identified that the added mutex contender could finish too early. A further RED control failed twice; the final fixture explicitly proves the same backend PID waits on mutex `(732814,1)` before releasing the contender, then proves SQL006 waits on protocol `(732814,3)`. Original history, permissions, mode, drift and unsettled-operation assertions remain intact. PG18 targeted 13/13 pass. No SQL or runner implementation was modified for this test fix.

### T02 / P3 — overload and local environment observations retained

Four simultaneous suites initially shared two databases and database-global advisory locks, unlike the four hosted matrix cells. In a later such run a lease-clock probe could not prove the lease was still valid while waiting. This does not demonstrate accepted expired completion; it is a failed test precondition under the shared stress setup. No assertion or lease timeout was loosened.

The final local matrix uses a distinct database per cell: PostgreSQL16/18 on ports55446/55448, Node22 on `math_universe_test`, Node24 on `math_universe_integration`, with two matrix processes at once and the unchanged internal test concurrency4. All tests and original lock-wait assertions run.

Browser's initial attempt lacked the configured local browser cache. A loaded six-worker run then encountered navigation timeouts; the same full14 tests passed with the approved cached browser, isolated Python HTTP port and one worker. No browser code, assertions, timeout or retries were changed. Failed logs remain in the evidence directory.

### C01 — workflow context regression corrected

The first pushed implementation (`6e83284`) incorrectly referenced `runner.temp` in job-level env; all five workflows failed before jobs. GitHub's [context availability contract](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability) does not permit runner there. A new RED regression caught it; the path now appears in both precheck and provenance **step** environments. `e8af230` has all five workflows green. No fallback or check suppression was used.

## Verification matrix

| Check | Result |
|---|---|
| Node22 / PG16, isolated local cell | 448 passed, 0 fail/skip/todo |
| Node22 / PG18, isolated local cell | 448 passed, 0 fail/skip/todo |
| Node24 / PG16, isolated local cell | 448 passed, 0 fail/skip/todo |
| Node24 / PG18, isolated local cell | 448 passed, 0 fail/skip/todo |
| Native PDF + SQLite text | 76/76 passed, zero skips |
| Browser E2E | 14/14 passed, one local worker, zero retries |
| Validate CI contracts | 4/4 passed |
| Windows PowerShell5.1 Contracts | 49/49 passed, zero skipped/pending |
| pwsh Contracts | 49/49 passed, zero skipped/pending |
| Standalone materialized Pester integrity | Both shells pass, including marker absence, wrong archive digest, prepopulation, tamper/missing/extra/reparse cases |
| Migration mutex/protocol regression | 13/13 targeted live PG18 passed |
| Full base-to-HEAD diff check | Clean after removing one new test's trailing blank line |

These are bounded observations. Earlier failed full runs remain recorded in `node*-pg*.log`, `verified/`, and `last/`; final isolated results are in `isolated/`. The unreproduced exact cause of Q01 is not declared fixed.

## Hosted Actions and archive audit

Exact hosted checkpoint: `e8af230310af1ba346b9ebb184ee0ebce8e7aa45` (before the final test-only contention-proof strengthening and report). All five success:

| Workflow | Exact-SHA run | Result |
|---|---|---|
| Book Ingestion Native PDF | [39666198928](https://github.com/YehorBabenko88/math/actions/runs/39666198928) | success |
| Browser E2E | [39666198776](https://github.com/YehorBabenko88/math/actions/runs/39666198776) | success |
| PostgreSQL Integration | [39666198757](https://github.com/YehorBabenko88/math/actions/runs/39666198757) | success |
| Validate Math Universe | [39666198801](https://github.com/YehorBabenko88/math/actions/runs/39666198801) | success |
| Windows Deployment Contracts | [39666198936](https://github.com/YehorBabenko88/math/actions/runs/39666198936) | success |

All **9 ZIP archives** were downloaded using existing authorized gh access. Independently checked actual archive SHA256 against API digest; single bounded JSON entry; exact commit/tree/tracked-source digest/count; committed dependency hashes; repository, workflow, current run/attempt and complete unique required contexts. The real PowerShell consumer accepted all9 and rejected altered bytes, missing digest, missing/duplicate contexts, wrong dependency hashes and stale attempt.

The final report commit necessarily has a different SHA/tree. Its exact-SHA five-workflow and nine-archive verification is recorded after publication in the external final copy of this report and the task response; no checkpoint success is silently attributed to another SHA.

### Current event selection and HTTP401

Read-only current-source push selection passes. Adding a newer PR event or newer failed rerun fails closed. Baseline actual newer PR runs also block older push evidence. This conservative event policy is retained: **no fallback to an old success**.

A fresh unauthenticated artifact ZIP GET returned HTTP401, while authorized gh archive reads worked. The updater's unauthenticated artifact transport remains an explicit operational blocker. No token extraction, logging, credential modification or production credentials were introduced. A separately reviewed authorized transport design is required before real deployment.

## Commits

```text
2128b7635510bf45c9e4f781dcd4ad50e7b8acc7 fix(ci): verify clean materialized Pester installation before import
c37590bd875e8347d3cb27c44f10193d8fb40d4e fix(sql): bind checkout validation to raw Git objects and exact inventory
cfd8a0d4102327ddad081cef03294d4b354a8564 fix(deps): reject unreviewed npm installation directives
867eb12eefd26d88146254811f1858e4504d62e8 fix(provenance): bind qualified evidence to pre and post test source identity
6e83284bba859a29cf8a63c555ba8ffb23142e19 test(postgres): synchronize protocol lock probe after migration mutex
e8af230310af1ba346b9ebb184ee0ebce8e7aa45 fix(ci): bind receipt path in supported step context
f90ac4d6c5e832fc0332ca508f4daa25d0599dcb test(ci): prove migration mutex contention and clean regression formatting
```

The report is committed separately after these implementation commits. Published HEAD is the descendant report commit, not a claimed self-referential hash inside this file. Use `git rev-parse HEAD` or the external final report/task response for its exact identity.

## Remaining acceptance gates

1. Independently review F01–F05 on the exact final published SHA.
2. Diagnose Q01 with an exact safe underlying-error reproduction; add RED/GREEN before changing queue behavior. Preserve fail-closed corruption/orphan/freeze semantics.
3. Keep the event policy fail closed and resolve artifact authorization through a separately approved operator transport design.
4. Treat same-user execution and installed dependency/runner trust as boundaries requiring isolation, not something source hashes solve.
5. Historical ledgers still require genuine historical evidence; no checksum repair/adoption from current files is permitted.

No main/PR12/settings/Cluster Grid/production DB changes, merge, deployment, service restart or cutover were performed. Disposable tests only. **Code integration NO-GO pending Q01 and independent review; production NO-GO; Book production gate CLOSED.**
