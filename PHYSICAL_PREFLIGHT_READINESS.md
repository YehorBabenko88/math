# PHYSICAL_PREFLIGHT_READINESS — PR31 independent engineering audit

Audit date: 2026-10-25. **PHYSICAL_PREFLIGHT_READINESS = BLOCKED_FOR_G1. Q01 OPEN. Production NO-GO. Book production gate CLOSED.** This is bounded evidence for further code review and preparation, not physical authorization or a production acceptance.

## Exact identities and scope

- PR31: https://github.com/YehorBabenko88/math/pull/31 (Draft, unchanged).
- Candidate HEAD: `cb168925b5aeec0c957137dd94ab72c64f0bd333`.
- Candidate tree: `10cfd29f5d2c75e841d88dd70bef8773dada8287`.
- Branch: `integration/math-issue20-physical-preflight-20261025`; base `integration/math-parallel-audit-20261023`.
- PR merge commit: `1b99e5c85bc8b98d0ea2552d3cf1f6dab470dd13`; parents `20ede51c6e5eddbf49fde709f8af5e77a319e1c7`, `cb168925b5aeec0c957137dd94ab72c64f0bd333`; tree exactly equals candidate tree. PR-event source SHA is this merge, not a direct HEAD checkout. Push-event artifacts use candidate HEAD directly.
- Report worktree: `work/math-pr31-readiness`, isolated branch `audit/pr31-physical-readiness` from exact candidate. Only report/evidence committed here; fixes are separate, unmerged branches.
- Candidate inventory: 334 tracked files, 126 test-directory files, 12 workflows. All 34 selected merged-file blobs match at least one PR21–29 source-head blob. This verifies composition, not correctness. See `docs/audits/pr31-readiness/merged-source-blobs.tsv`.

No main/source-PR edits, merges, deployment, service restart, production migrations, cutover, physical G1 or connections to LS5/PC4/ADMIN PC occurred. Local executions were pure tests, mock/compile-only containment, readonly source checks and evidence verification. Actual SQLite stress, native PDF, PostgreSQL and Windows fixture execution evidence comes from disposable GitHub-hosted jobs.

## Architecture and contract map

| Area | Modules / contracts | Review result and limits |
|---|---|---|
| Mathematical frontend | expression, implicit3d, geometry/PDE, visualization and experiment modules | Existing scalar precedence/evidence contracts retained; browser and full suite cover integration. Numeric reproduction is not theorem proof. |
| Scientific providers / adapters | provider clients, registry/planner/persistence, graph evidence | Metadata/provenance and review remain distinct from validity. Provider citations and `.citationExamples` do not establish unrelated node-output reproduction. |
| Book extraction | pdf/codex/candidate/worker, queue-contract/sqlite-text, review/knowledge-boundary | Untrusted PDF/AI output remains extraction data; source/page pins and human review are not mathematical proof. Worker completes into review_required. |
| Book SQLite | queue, fenced leases/checkpoint/snapshot/backup, WAL freeze | Bounded detached rollback-journal correction retained. Detailed filesystem/transaction limits below. |
| Book PostgreSQL | lossless codec/queue, separate SQL001–005, transfer/gate | No automatic substitution of generic store for Book API. operator-cutover-prerequisites blocker remains. |
| Generic PostgreSQL | legacy/fenced stores, workers, SQL001–006/ledger | SQL006 wall-clock after locks, acquisition tokens and MU001 conversion retained; full live tests cover four runtime combinations. No startup migrations authorized. |
| Cutover rehearsal | controller/source/postgres/journal/backup/signed sessions | Controller only accepts rehearsal; ACTIVATED is a rehearsal record, not routing activation. Operator provisioning, process attestation, role isolation and production routing remain blockers. |
| Knowledge candidates | inert records, CandidateGraph/store, verification request | Candidates remain CANDIDATE; no Book/OCR/AI automatic VERIFIED path. Legacy unprefixed hashes require explicit reviewed conversion to KG revision/hash contracts. |
| Kernel boundary | signed result, persistent one-shot verifier, replay ledger | Signature means AUTHENTICATED_RESULT_ONLY, not theorem validity. Confirmed pending-state defect corrected separately (F03). Experimental implication kernel has finite supported calculus, not general mathematics. |
| AI orchestrator | policy/plan/artifacts/receipts/replay/inspect | Claims retain UNATTESTED_CLAIM; inspect returns NOT_VERIFIED / publication DENIED. Git shape40/64 is not repository existence or independent attestation. |
| Windows preparation | lab PowerShell guards, dormant C# Job Object, updater | Physical -Execute still fails closed. Separate source-identity and drain fixes/harness prepared below. No updater or service execution. |

See `boundary-audit.md`, `queue-audit.md` and `parallel-proposals.md` in the evidence directory for concrete file references, retained probes and excluded claims.

## Findings and minimal fixes

| ID | Priority / classification | Confirmed observation | Disposition |
|---|---|---|---|
| F01 | P1 prospective containment acceptance defect; dormant helper | TerminateJob followed by handle close did not establish zero active descendants; injected-kernel RED observed missing drain. No current physical execution path exists. | Draft PR41 adds bounded ActiveProcesses query/drain and hosted fixed synthetic fixtures. Mock GREEN; native acceptance pending. |
| F02 | P2 preflight runtime defect | Stable dirty tracked source passes original HEAD + equal-current-hashes checks and receives PREPARED. Baseline reproduction recorded only HEAD/root Git reads. | Draft PR40 adds trusted-kit committed/index/worktree identity before/after read-only snapshot, rejects Node preloaders. Standalone RED, 12 Pester GREEN. |
| F03 | P2 verifier state-contract defect | A correctly signed result with requested_status VERIFIED/non-PENDING is accepted and consumes nonce. Result still only AUTHENTICATED_RESULT_ONLY; no graph VERIFIED escalation reproduced. | Draft PR42 adds one PENDING guard. RED before change; Node22/24 41 PASS each. Invalid state leaves same nonce available for original valid request; replay still rejects. |
| L01 | P1 acceptance BLOCKED, not a new reproduced runtime bug | Native hosted Job Object fixture has not executed; old/mock/static tests cannot prove Windows containment or owner-crash behavior. | Keep physical G1 BLOCKED. run40184801086 remains queued with no steps/artifacts at last review. |
| L02 | P2 operational/security limit | Pathname lstat checks are not hostile same-user filesystem confinement; later replacement after validation remains a check/use race. | Trusted queue directory/operator boundary required; no claim that Q01 correction solves filesystem sandboxing. |
| L03 | P2 evidence limitation | Aggregate CI coverage jobs and some push Q01 cells remain queued/running; new correction branches have pending hosted checks. | Do not count as PASS, do not merge/activate on this report. |
| L04 | P2 evidence limitation | npm advisory endpoint failed TLS certificate verification. | Dependency lock/SQL byte policy verified; vulnerability-audit result BLOCKED. TLS/CA configuration not weakened or changed. |

No new confirmed P0 runtime defect was found. Q01 remains an unresolved P0 acceptance blocker. Findings are not proof of complete absence of other defects.

### Separate correction heads (not combined into candidate)

| Draft | Branch | Exact HEAD | Tree | Evidence |
|---|---|---|---|---|
| https://github.com/YehorBabenko88/math/pull/40 | fix/pr31-preflight-source-identity | 8ec4d1e2fe14ba917c715bf6e44465ea31dd50e7 | 3fb15a3a081ad03ccc7f9ac5e9dd6c6e820a7bd1 | 12/0/0 Pester on local PS7; PS5.1 blocked by existing policy; trusted readonly verifier independently PASS |
| https://github.com/YehorBabenko88/math/pull/41 | test/pr31-windows-harness | 280096ab24ce4f32cdaf17bd4a928f66f4f2dbda | c3723dcf4541ffad8b0aa9ceca54b4946f1114db | 11 mock cases +3 static contracts + compile-only helper/fixture PASS; hosted native NOT_RUN_PENDING |
| https://github.com/YehorBabenko88/math/pull/42 | fix/pr31-verifier-pending-state | ab8b8099189e599ed61c7e7891c66e3585cc0fbd | 87e4a599f682f0efb09f3cd41b5ce72c7d0bb263 | RED3PASS/1FAIL before fix, GREEN41PASS/0FAIL/0SKIP each Node22/24 |

Test-only queue review branch ffb87e47268075c669890e2438089a8be60dc99c/treee2ff47d870dd768f21a0c805cad3addefc2234a4 increases deterministic cases11→21 including real POSIX symlink replacement; no production changes or Draft PR. Dedicated run40184470515 queued, not PASS. Never merge that branch merely to imply a new bug fix.

## Q01 forensic and correction verification

Six previously retained error-only native receipts (diagnostic head19c73849795ef9965c34d14bd6b1de8c33d2e7b7, run40015024687) show regular nonsymlink queue.sqlite-journal nlink0,size512: four Linux22 and two Linux24 rejections at preflight/transaction guard. This establishes the observed guard mechanism, not a traced exact deleting syscall/COMMIT schedule or a universal explanation for every historical failure.

PR31 rechecks exactly once only when the original entry is a regular nonsymlink rollback journal with nlink0. Existing ENOENT handling remains; a linked regular replacement must satisfy nlink1 and size bound. Persistent0, symlink, hardlink, oversized/nonregular/denied replacements stay rejected. Main DB/WAL/SHM zero-link rejection unchanged. No generic retry, auto schema repair, timeout inflation or production data rewrite was introduced.

Exact PR31 controlled regression:11PASS per Linux/Windows ×Node22/24, zero skips. Current Q01 PR-event12 verified bundles:128PASS/0FAIL/0BLOCKED/0SKIP. Includes quick7, stress3, fault22 per OS/runtime: native fresh-open10+100+300+1000 pairs per combination (5640 total), plus400 diagnostic pairs. Checks include stale exists, empty orphan rejection, lock4.5/5.5s, initialize1/6.5s, before-COMMIT barriers, crashes/rollback/restart/checkpoint, malformed schema/metadata/payload, SQLite integrity/exact metadata/jobs.

Independent verifier checked external expected case inventory, lifecycle/barriers, event sequence and worker exits, JSONL, exact JUnit representation and internal SHA256 manifest. All source trees match target. Push-event11 available bundles separately verify125PASS; remaining stress cell is NOT_RUN_PENDING. Duplicated PR/push runs are not summed as unique coverage.

## CI matrix on exact candidate / equivalent PR tree

Every listed run is attempt1, head cb168925 and exact PR31 branch. CI from other branches initially sharing the same HEAD is excluded. Full per-job steps/states/URLs in `ci-snapshot.json`; test counts and raw summary evidence in `TEST-COUNTS.md`/`test-counts.json`.

| Workflow | PR run | Push run | Verified executed test evidence | Run-level snapshot |
|---|---|---|---|---|
| PostgreSQL Integration | https://github.com/YehorBabenko88/math/actions/runs/40183990711 | https://github.com/YehorBabenko88/math/actions/runs/40183964407 | Four cells each649PASS/0FAIL/0SKIP, all tests/*.test.mjs unfiltered; real PG16/18 | matrix cells success, aggregate queued in both |
| Q01 Queue Reliability | https://github.com/YehorBabenko88/math/actions/runs/40183990649 | https://github.com/YehorBabenko88/math/actions/runs/40183964438 | PR12bundles128PASS; Pester8/0/0; unit15/0/0 eachcell. Push11bundles125PASS available | PR aggregate queued; push incomplete |
| Q01 Detached Journal Regression | https://github.com/YehorBabenko88/math/actions/runs/40183990749 | not triggered on integration push | 11PASS each of4cells,0FAIL/0SKIP | success |
| Q01 Windows Containment Preparation | https://github.com/YehorBabenko88/math/actions/runs/40183990683 | https://github.com/YehorBabenko88/math/actions/runs/40183964395 | PS5.1/7 ×Node22/24:3Nodecontracts +7fakekernelcases each; zero native calls | PR aggregate queued; push success |
| QA SQLite Q01 Diagnostic | https://github.com/YehorBabenko88/math/actions/runs/40183990697 | not triggered on integration push | 4unitPASS +1diagnosticPASS per22/24; diagnostic is not acceptance | success |
| Book Ingestion Native PDF | https://github.com/YehorBabenko88/math/actions/runs/40183990825 | https://github.com/YehorBabenko88/math/actions/runs/40183964363 | 90PASS/0FAIL/0SKIP | success |
| Browser E2E | https://github.com/YehorBabenko88/math/actions/runs/40183990654 | https://github.com/YehorBabenko88/math/actions/runs/40183964374 | 14passed; matched log line does not separately emit skipped count (unknown, not invented0) | success |
| Validate Math Universe | https://github.com/YehorBabenko88/math/actions/runs/40183990746 | https://github.com/YehorBabenko88/math/actions/runs/40183964400 | 4PASS/0FAIL/0SKIP | success |
| Experimental Proof Kernel | https://github.com/YehorBabenko88/math/actions/runs/40183990756 | https://github.com/YehorBabenko88/math/actions/runs/40183964372 | 27PASS/0FAIL/0SKIP each22/24 | success |
| AI Orchestrator Policy | https://github.com/YehorBabenko88/math/actions/runs/40183990699 | https://github.com/YehorBabenko88/math/actions/runs/40183964430 | 81PASS/0FAIL/0SKIP each22/24 | success |
| PG wait witness focused workflow | NOT_RUN | NOT_RUN | trigger limited to original fix branch; corresponding tests are included in full649 suite | not a PR31 workflow execution |

Snapshot:20runs/71jobs,66completed-success,4queued,1in-progress. This is not an all-green declaration. Counts may advance after capture; exact capture time is in ci-snapshot.json. No matched completed-test summary has nonzero failure/skips. Local focused boundary suites each164PASS/0FAIL/3SKIP under22/24 (two unavailable Windows symlink privileges and one POSIX-only mode check); these3 are explicitly NOT_RUN, not claimed passed. Do not sum overlapping suites to invent a unique grand total.

## Artifacts and reproducibility

-43 available PR+push ZIPs downloaded, SHA256 matched authenticated GitHub API digest; IDs/names/run/attempt/size/digests retained in artifact-digests.json. PR-event23, push20 at capture. Missing future artifacts are not acceptance evidence.
-23 Q01 bundles independently validated: PR12/128cases, push11/125cases; q01-verified.json.
-18 release-provenance payloads checked for exact source/tree/repository/workflow/run/attempt/context and committed npm/package/Python hashes. They are **self-reported pre/post tracked-tree evidence**, not independent attestation. Source tree and archive/run identity are additional checked facts.
-65 completed job raw logs retained locally from the earlier count snapshot; local-evidence-sha256.json records314 evidence files including logs, ZIPs, reports and probes. One newly completed job has metadata but no log in that earlier collection. External raw files are not embedded in this report branch; artifact IDs/URLs permit authenticated re-download. ZIP contents are inventoried in zip-inventory.json.
-Local SQL verifier PASS for all11 historical generic001–006/Book001–005; dependency-lock validator PASS. No historical SQL or ledger hashes changed. npm ci and hash-only wheel installs remain mandatory. Python artifact scope is CPython3.12 WindowsAMD64/glibcLinuxx86_64 only. npm advisory query BLOCKED by TLS verification error; no workaround applied.
-All external Actions refs are immutable40hex; workflows have contents:read, timeouts, no continue-on-error. Hosted OS images, Node major resolution and PostgreSQL image tags are still moving operational dependencies; this is not bit-for-bit whole-platform reproducibility. Existing strict release artifact/source qualification retained.

## Windows containment acceptance and future diagnostics

Draft PR41 adds fixed synthetic fixture modes only: assign suspended process before resume, membership, root-exit descendant drain, timeout/drain, assign rejection, argument/environment fidelity, owner crash with captured process handles, outside/reparse rejection. Independent parent watchdog fails on forced cleanup; owner-crash observer holds no job handle. Native run https://github.com/YehorBabenko88/math/actions/runs/40184801086 currently QUEUED, no steps/artifacts. A possible native TerminateProcess-after-drain behavior remains unconfirmed and intentionally unpatched pending native RED. Native execution is allowed only in disposable hosted Windows; no local/physical native call occurred.

For future ADMIN PC preflight, Draft PR40's `docs/audits/pr31-preflight-source-identity.md` contains read-only identity/version/path/policy commands. They are documentation, not authorization to execute there. Expected HEAD/tree are above. No Set-ExecutionPolicy, Defender/ACL changes, installation, queue launch, Job Object launch or -Execute is authorized. If policy/tool authenticity/path/identity is unproved, return BLOCKED. Separately authenticate the auditor kit and Node/Git executables; clean git status is insufficient for EOL byte identity. Source snapshots do not provide same-user/process/filesystem isolation. Job Objects constrain process lifetime, not filesystem/network access.

## Safe next acceptance checkpoints (not executed integration plan)

1. Independently review Draft40/41/42 and test-only queue additions; do not import broad moving-head parallel PRs blindly. PR32 store change regresses omitted-entity duplicate idempotency; PR37 static sentinel spelling test does not reproduce lost BOOK_QUEUE_INITIALIZING (baseline already preserves the same error object).
2. Complete exact-head hosted native, corrective-branch and aggregate CI jobs; verify new archives and zero skipped/cancelled required coverage. If a new failure appears, reproduce before changing code.
3. Only after separate approval combine accepted corrections in another isolated candidate and rerun the full matrix/source/artifact audit. Current cb tree does not contain these fixes.
4. Independently accept containment, watchdog/failure cleanup, source/tool authentication, lab directory and permissions policy, then request explicit physical preflight authorization. Do not equate hosted success with G1 permission.
5. Keep Book cutover disabled and production NO-GO. No real migration, service restart, deployment or scientific VERIFIED publication follows from this report.

**Decision:** GO for independent review of the bounded evidence/corrections. NO-GO for physical G1, automatic production activation, deployment or scientific publication. Q01 OPEN.
