# Math Universe — F01 + F02 integration audit

Date: 2026-10-19. Branch: `integration/math-f01-f02`.

**GO for further independent code review only. NO-GO for production deployment, migration, service restart or cutover. Book production gate remains closed.**

## Exact source and preserved history

Base: `f1c29893d5826bdb2bfd24def2ee54a4377a9b8e` (PR #10's requested HEAD).

| Order | Exact source | New integration merge |
| --- | --- | --- |
| 1 | `fix/pg-fenced-lease-clock`, `a686af116e55d9a4ef6a98d35e1b89e120efe0d0` | `4dcec7e4c739576702f5a988b0d851c929d29f9d` |
| 2 | `fix/windows-release-artifact-binding`, `858e65d4646ff24e990e401964e96c2e0a74812f` | `51691f6f6024e6a2563f6ed4e11d7b2ed741dd94` |

Both used `git merge --no-ff <exact-SHA>` in that order, with no conflicts. Before each merge, the target branch/clean worktree, all source local/remote SHA identities and clean source worktrees were checked. Source history is preserved; no squash/rebase/cherry-pick or changes to the source branches were made.

**Exact audited executable/test HEAD: `51691f6f6024e6a2563f6ed4e11d7b2ed741dd94`.** Relative to base this is 19 changed files, 641 additions, 38 deletions and nine reachable new commits. No integration runtime patch was needed. This final report adds only documentation; its own exact publication SHA is supplied in the final handoff/verification manifest because a committed file cannot contain its own Git object hash.

Worktree: `<LOCAL_WORKSPACE_PATH>`.

The audit rechecks the author reports against retained original probes, actual databases, source and fresh combined tests. It is a separate contract cross-check in the same chat, not organizationally independent external review. A subsequent reviewer should inspect this exact combined diff rather than treating green CI as approval of earlier PRs or production.

## Independent negative probes

### F01: original minimum-ten-second lease / eleven-second lock wait

Repeated the unmodified external `outputs/pr10-lease-wait-probe.mjs` against this merged checkout and real PG16/18, before the full suites (long global locks were not overlapped with them). Each owned UUID schema starts fresh; the test explicitly activates generic fenced protocol only there. Both cases record expiredAtUnlock=true and return **completed=false, code=JOB_LEASE_LOST, state=running**. Confirmed expired-completion cases: **0/2**. Log: `outputs/f01-f02-integration-original-lease.log`.

Existing merged regressions additionally exercise complete, renew, checkpoint and fail after advisory, job-row and protocol-row waits; delayed acquire freshness; SKIP LOCKED; concurrent same-worker reacquisition; stale-token rejection; exactly one successful racing completion; and a direct SQL guard at a database-defined expiry boundary. Short owned future deadlines in normal CI keep global test locks bounded; the original public ten/eleven-second probe remains separate evidence.

### F02: existing ordinary SHA directory / runner substitution boundary

External `outputs/f01-f02-integration-artifact-probe.ps1` dynamically extracts the actual merged updater's existing-target/pre-test block, imports only the reviewed helper, and creates a harmless ordinary non-Git directory named with a SHA. Expected repository points at the real trusted local Git repository. Result: **Release Git association failed before runner; marker not written**. No installer, NSSM, pointer, activation or service block executes. Log: `outputs/f01-f02-integration-original-artifact.log`.

The first external harness attempt selected two Git applications from PATH and hit an unrelated command-resolution error. That was not accepted as F02 evidence: the harness now chooses one explicit application and accepts only the expected association-rejection class. Repository production code was not changed to accommodate the harness.

All 39 merged Pester fixtures pass: correct registered worktree reuse, wrong HEAD/repository, dirty tracked/index state, assume-unchanged runner alteration, binary changes, source mutation by an actual harmless tracked Node fixture, lexical aliases, junctions, tracked Git symlink and submodule modes, custom roots, and second validation before the candidate pointer. Existing rollback and exact-SHA/current-attempt checks remain in the inventory.

A separate full-tree read-only helper smoke against this exact merged HEAD passes, including tracked SQL006 and its runner. Log: `outputs/integration-f01-f02-source-smoke.log`. This checks source association under trusted checkout policy, not immutable dependency bytes.

## SQL006, ledger and cross-module contracts

- Generic manifest includes six migrations. SQL006 is additive; all ten historical generic SQL001–005 and Book SQL001–005 files are physically byte-identical to the initial exact-base checkout, not merely Git-diff equivalent. No ledger history/checksum is rewritten or inferred from current source bytes.
- SQL006 takes exclusive protocol advisory lock `(732814,3)` before replacing the guard. Tests prove actual queued lock state for the migration backend while old guarded writers hold a shared lock. Verified SQL005→006 upgrades preserve historical ledger rows and both legacy/already-fenced modes, plus SECURITY DEFINER, pinned search_path and revoked PUBLIC execute properties.
- Store mutation paths acquire the protocol barrier and target-row lock before current wall-clock ownership predicates. The guard samples `clock_timestamp()` after its own protocol-row wait. Narrow SQLSTATE MU001 maps to public JOB_LEASE_LOST. Acquisition tokens and same-worker protection remain intact; expired operations cannot use the old transaction-start clock.
- Strict raw-byte SQL drift, malformed ledger, prefix/history checks, migration replay, concurrency and before/after COMMIT crash cases remain in the complete live suites. Installing SQL006 is an explicit administrator action, never service startup behavior.
- Generic legacy mode intentionally retains legacy semantics; startup does not auto-activate fencing. A SQL005-only database is not qualified for old direct-writer expiry behavior by merely changing JavaScript. Corrected store **and** SQL006 are the reviewed fenced contract. No Book backend substitution occurs.
- Windows gate still requires exact candidate SHA/branch, trusted workflow IDs/paths, latest activity/current attempt and all four PG cells plus aggregate, Native PDF, Browser, Validate and both Windows shell jobs. The authoritative full runner discovers all 82 test files; its real DB tests apply/verify SQL006. Thus unchanged gate contexts cover the new release requirement rather than silently retaining a five-script inventory.
- Source identity checks run before candidate tests and again inside the forward candidate pointer callback, after the final CI refresh. Rollback pointer writes skip candidate validation so an invalid candidate cannot prevent restoration. Revalidation detects source changed by the candidate's own runner. Custom Root, lock and atomic pointer architecture remain unchanged.
- This verifies code/test/ledger **compatibility**, not that any application/production database already has SQL006. The updater does not migrate production or attest its schema, workers or routing; those remain separate operator prerequisites. No updater was executed.
- Production controller mode still throws; boolean/plaintext confirmation still returns incompatible before any DB query. An independent tripwire probe confirmed zero DB calls. Book controller/gate/SQL/routing files have no integration diff. Numeric reproduction remains distinct from scientific review/theorem proof; this merge changes neither evidence API nor automatic promotion rules.

## Fresh test matrix

Full command: `node scripts/test-full-ci.mjs`, all **82** `tests/*.test.mjs`, no exclusions/name filters. Node22.23.3 and Node24.20.0; actual disposable loopback PG16/18 databases as math_test, owned UUID schemas only. BOOK_INGESTION_PYTHON is the absolute prepared native-PDF runtime. Locally started test clusters were stopped after qualification.

| Profile | Result | Retained external evidence |
| --- | --- | --- |
| Node22 × PG16 | 407/407; zero fail/cancel/skip/todo | `integration-f01-f02-node22-pg16.log` |
| Node22 × PG18 | 407/407; zero fail/cancel/skip/todo | `integration-f01-f02-node22-pg18.log` |
| Node24 × PG16 | 407/407; zero fail/cancel/skip/todo | `integration-f01-f02-node24-pg16.log` |
| Node24 × PG18 | 407/407; zero fail/cancel/skip/todo | `integration-f01-f02-node24-pg18.log` |
| Dedicated Native PDF | 76/76, zero skips | `integration-f01-f02-native.log` |
| Chromium browser | 14/14, retries0 | `integration-f01-f02-browser.log` |
| Local pwsh/Pester4.10.1 | 39/39, zero skipped/pending/inconclusive | `integration-f01-f02-pester.log` |
| Source syntax | 70/70 source modules | `node --check` |
| Cumulative whitespace / checkout | clean / exact source HEAD | Git checks |

Browser uses an external temporary config/server on own port4181, unchanged repository tests. Native profile explicitly expands the CI Book test glob. Local PS5 Pester remains blocked by existing host execution policy; no bypass/change was attempted. Both Windows shell profiles are qualified by normal exact-SHA GitHub jobs, rather than claiming local PS5 execution.

All five independent push workflows completed successfully on exact source HEAD `51691f6f6024e6a2563f6ed4e11d7b2ed741dd94`:

- [PostgreSQL full matrix and aggregate](https://github.com/YehorBabenko88/math/actions/runs/39322277193).
- [Native PDF](https://github.com/YehorBabenko88/math/actions/runs/39322277177).
- [Browser E2E](https://github.com/YehorBabenko88/math/actions/runs/39322277200).
- [Windows Contracts, both powershell and pwsh](https://github.com/YehorBabenko88/math/actions/runs/39322277154).
- [Validate](https://github.com/YehorBabenko88/math/actions/runs/39322277231).

The final report-only commit is independently checked again in the handoff/`outputs/integration-f01-f02-final-manifest.json`; prior-SHA success is not substituted. The report's own final object SHA and final run IDs are given there and in the final response, avoiding a self-referential Git hash.

## Findings and disposition P0–P3

No new blocking integration defect was reproduced. F01 and F02 are closed **within the tested supported-API/trusted-local-source boundaries**, not as universal host/database security proofs. No integration runtime fix or invented new RED/GREEN cycle is claimed; original RED evidence remains in the source reports, and original probes were independently rerun on the combined code.

| Priority | Finding / status | Disposition |
| --- | --- | --- |
| P0 | None confirmed | Bounded audit evidence, not proof of absence |
| P1 governance, R04 | Fresh read-only GitHub main metadata: protected=false; repository rulesets=[] | Still open. Green Actions are not enforced branch protection/review. No settings changed |
| P2, F03/R06 | Raw SQL EOL depends on checkout, while ledger deliberately authenticates raw bytes. npm lacks a lockfile; complete hash-pinned Python/transitive artifacts and immutable Pester/action downloads are absent | Still open. No normalization/hash adoption or immutable release claim |
| P2 scope, R09 | Full original multi-provider/science product pipeline remains incomplete; OpenAlex/Crossref search does not make the other normalizers/links complete providers | Separate scope decision/work; not closed by this remediation |
| P2 qualification, R11 | Fixed bounded PDF subprocess is not an OS sandbox for native parser compromise | Separate parser isolation qualification; no malicious production document testing claimed |
| P2 operational prerequisite | No production schema006 handshake, trusted operator provisioning, process attestation, routing or DB role isolation qualification | Keep production NO-GO and Book gate closed |
| P3 | F01 authority is checked at DB wall time after locks, not promised across later commit/network/scheduler delay or host clock jumps | Returned lease is a snapshot, not future ownership guarantee |
| P3 | F02 trusts local Git/runtime/repository and cooperating updater lock; mutable dependencies/caches, manual concurrent/hard-link/admin writes and atomic filesystem/runtime attestation are outside proof | No real host deployment qualification |
| P3 | GitHub API observations are non-atomic; workflow IDs require reviewed maintenance; real NSSM/install/reboot/HTTP release identity and rollback drills remain untested | Separate supervised restricted-account qualification only after authorization |

### F03/R06: explicit EOL/history boundary

Source association may accept an allowed strict text checkout's CRLF representation against its LF Git blob. This comparison occurs only in memory and never changes SQL or ledger bytes. Migration integrity continues to hash actual raw UTF-8 working-file bytes: same Git SHA on another checkout can legitimately fail historical hash verification. That failure is safe and is not evidence authorizing backfill. No existing migration file is normalized, no current hash is accepted as historical execution proof, and no filename-only history is automatically trusted. A future immutable-byte/dependency release policy needs a separately reviewed compatibility plan.

## GO / NO-GO and stop point

**GO only for further independent review of this exact integrated code.** Do not infer authorization to merge into main or older PRs from this report. Main/PR #10/source branches/settings/Cluster Grid and production remain unchanged.

**Production NO-GO.** No real deployment, installer, NSSM, service restart, production migration or cutover occurred. Only expressly requested history-preserving feature merges and isolated synthetic test migrations were performed. No PR was created or edited. Production gate stays closed.

Rollback before any deployment means abandoning this isolated integration branch; there is no production effect to undo. Future integration/rollout decisions require their own authorization and review. Work stops after publication and exact-final-SHA verification.
