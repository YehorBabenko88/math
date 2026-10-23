# Math Universe — ABC integration audit

Date: 2026-10-19. Branch: `integration/math-remediation-abc`.

**Disposition: GO for independent integration review only; NO-GO for production deployment, database migration or cutover. Production gate remains closed.**

## Exact history and scope

Base: `740f35742aa585f67471edea2fab5f5205a321f6`. Audit reference `22c0b51b6da4d52ded3c4d619c4e0a651e5f86b3` was read only, not merged.

Three explicit `git merge --no-ff <exact-SHA>` operations, in requested order:

| Merge | Source HEAD | Integration merge commit |
| --- | --- | --- |
| A — Windows | `bc22584a7f81a0f7e63af588b5cf349dcc458b4e` | `f0d75832d24abd3530d2002fb6063054f66875ef` |
| B — PostgreSQL | `bc7b3b31d54ade9a258f4181f4bb4282c3bb9025` | `d301f60d5efc90a967dd6a221d3458e2934b4ab5` |
| C — science | `56e5db1c7cc8f098548ef9ac7987a4a435b89bd2` | `cf30358379769e6df5b6a8ae197ed7c370f58bc2` |

Before **each** merge, the target branch name and clean worktree were checked; all three source branches' local HEADs and read-only GitHub branch HEADs matched the exact requested SHA, and all three source worktrees were clean. Merges had no conflicts. No squash, rebase or cherry-pick occurred.

Exact audited executable/test commit: **`d3d98ebeadce3822ae8420ab1d2650096eb08f8e`** (`test(integration): verify ABC evidence persistence fencing and closed gates`). The final report-only commit retains identical source/test/workflow bytes. Its exact final publication SHA and exact-SHA Actions are provided in the final handoff, because a committed report cannot contain its own Git object hash. Verify the checkout identity with `git rev-parse HEAD`.

Worktree: `C:/Users/Administrator/Documents/Codex/2026-10-14/https-github-com-yehorbabenko88-math-actions/work/math-remediation-abc`.

## Contract audit

- All 70 source `.mjs` modules pass `node --check`; static relative imports resolve. Full tests exercise imports under Node22/24; this is not a claim that every optional external integration is configured.
- Search of shipped source, frontend and tests found `.citationExamples` consumers only in tests and the graph association API itself. No frontend/runtime consumer promotes its numeric status to node-output confirmation. The observable `.evidence` removal is documented in C's report. Separate Book candidate `.evidence` fields and journal evidence are unrelated contracts and remain intact.
- `validateGraphNodeEvidence()` explicitly returns `nodeOutputValidated:false` and `relationship:'independent-citation-examples'`, with no top-level status. Numeric `reproduced` is not scientific review or theorem `proven`.
- Registry JSONB stores a versioned envelope around exact original JSON text. Integration tests preserve IDs and exact export bytes with Unicode keys, U+0000 and lone UTF-16 surrogates; restored validation state remains unreviewed. Existing real-DB suites cover approved/rejected states, corrupted checksums and old unverifiable JSONB.
- Generic legacy service remains the default compatibility path; fenced mode requires explicit configuration and separately persisted protocol activation. Startup does not migrate or activate. Acquisition identity protects same-worker reacquisition; stale completion and unguarded legacy completion fail after activation. Generic protocol activation in tests affects only a random test schema, not Book backend routing.
- Generic and Book migration runners share the SQL wrapper lexer but have separate ledger tables and lock identities. New same-schema integration coverage applies both, replays both, rejects independent raw-byte source drift and then replays original bytes successfully. Existing suites cover nonempty filename-only histories without automatic trust/backfill, concurrent runners and ambiguous COMMIT/crash recovery.
- Windows updater tests use temporary filesystem fixtures and injected service delegates only. Trusted workflow IDs/paths, exact SHA/branch, latest activity/current attempt and mandatory matrix/PDF/Browser/Validate/both-shell job contexts remain enforced. Syntax, custom Root, lock, pointer replacement and rollback fixtures all pass. No updater, installer, NSSM, service restart or deployment was executed.
- Book production barriers remain unchanged: `BOOK_POSTGRES_BLOCKERS` includes `operator-cutover-prerequisites`; production controller mode throws. Boolean/plaintext confirmation fails before any DB call. Rehearsal controller's ACTIVATED state is simulated (`backendSwitched:false`), not routing activation. Existing tests exercise signed sessions, source freeze/WAL, journal, backup, migration001–005 and fencing.

## Integration tests and RED/GREEN disposition

New `tests/math-abc-integration.test.mjs` has three cross-module checks:

1. Plaintext/boolean confirmations cannot open the Book gate; production mode is rejected without touching DB.
2. Generic and Book ledgers coexist in one disposable schema and reject drift independently, retaining generic legacy mode.
3. Citation association survives registry JSONB with exact identity and Unicode; missing independent evidence blocks registry approval; fenced job reacquisition rejects stale/legacy completion and preserves `nodeOutputValidated:false` in the accepted result; Book gate remains closed.

No new integration conflict or failing implementation contract was reproduced: first merged full matrix passed 398 tests/cell. Consequently no integration runtime patch or invented RED defect is claimed. The three new conformance tests passed on the merged implementation; the complete matrix was then rerun with all three included (401 tests/cell). Original defect RED/GREEN evidence is preserved in the three source branches' committed reports. Negative assertions deliberately exercise rejected operations; they are not misrepresented as a pre-fix RED/GREEN cycle.

## Results

| Check | Result |
| --- | --- |
| Node22.23.3 × actual PostgreSQL16 | 401/401, 0 fail/cancel/skip/todo |
| Node22.23.3 × actual PostgreSQL18 | 401/401, 0 fail/cancel/skip/todo |
| Node24.20.0 × actual PostgreSQL16 | 401/401, 0 fail/cancel/skip/todo |
| Node24.20.0 × actual PostgreSQL18 | 401/401, 0 fail/cancel/skip/todo |
| Native PDF dedicated profile | 76/76, no skip/todo |
| Browser Chromium | 14/14, retries0 |
| Windows Deployment Contracts local pwsh/Pester4.10.1 | 24/24, no failed/skipped/pending/inconclusive |
| Source syntax and relative imports | 70/70 modules |
| Base-to-HEAD whitespace | clean |

Full command: `node scripts/test-full-ci.mjs`, all **81** `tests/*.test.mjs`, no filters/exclusions. Explicit `BOOK_INGESTION_PYTHON` points to the existing local native-PDF environment. `MATH_UNIVERSE_TEST_DATABASE_URL` selected only synthetic loopback `math_test`/`math_universe_integration` databases on ports55440/55439. Tests create UUID schemas and remove only their own resources. The two locally started disposable clusters were stopped after testing. No production DSN was used.

Native PDF: explicit expansion of `tests/book-ingestion*.test.mjs tests/book-sqlite-text.test.mjs`. Browser: external temporary config/server on isolated port4178, cached Chromium, unchanged repository test definitions. Local pwsh imports Pester4.10.1 and invokes the entire `tests/windows-deployment.Tests.ps1`. Existing local PS5 execution policy was not bypassed; Windows CI exercises both normal shells. Logs outside Git: `../../outputs/abc-final-node{22,24}-pg{16,18}.log`, `abc-native-pdf.log`, `abc-browser.log`, `abc-windows-contracts.log`.

Independent Actions on exact executable SHA `d3d98ebeadce3822ae8420ab1d2650096eb08f8e` all completed successfully:

- [PostgreSQL Integration](https://github.com/YehorBabenko88/math/actions/runs/39316400399): all four Node22/24 × PG16/18 cells and Full CI coverage aggregate.
- [Native PDF](https://github.com/YehorBabenko88/math/actions/runs/39316400437).
- [Browser E2E](https://github.com/YehorBabenko88/math/actions/runs/39316400420).
- [Windows Deployment Contracts](https://github.com/YehorBabenko88/math/actions/runs/39316400419): both Windows PowerShell and pwsh jobs.
- [Validate](https://github.com/YehorBabenko88/math/actions/runs/39316400402).

A read-only live release-gate smoke on that exact SHA accepted ten actual job objects from five trusted workflows and current attempts. It imported only `scripts/windows-deployment.ps1` and fetched GitHub JSON; it did not run the updater or service operations. Final report-only HEAD Actions are checked separately in the final handoff rather than reusing prior-SHA success.

## Findings P0–P3 and residual risks

**P0: none confirmed. No newly reproduced integration defect in the audited contracts.** This is bounded test/audit evidence, not proof of all runtime behavior.

| Level | Finding / reproducible limitation | Location / disposition |
| --- | --- | --- |
| P1 rollout blocker | Production identity provisioning, worker/process attestation, DB role isolation and routing are not qualified. Production controller mode rejects; gate remains false even with caller confirmation. | `src/book-ingestion/cutover-controller.mjs`, `postgres-json.mjs`; new negative test. Keep closed; separately authorize operational qualification. |
| P1 conditional rollout blocker | Generic **legacy** mode intentionally retains unfenced semantics. Only explicitly activated fenced mode establishes the reviewed token protocol. | `src/ingestion-service.mjs`; both modes tested. Do not label legacy workers fenced or enable automatically. |
| P1 governance carry-forward | Original R04 branch-protection/review enforcement is outside this change; settings were not changed or freshly certified. Green Actions do not establish enforced review. | Original integration audit. Administrative decision required separately. |
| P2 API compatibility | `.evidence` was intentionally removed from graph association response. External consumers may need migration; none were found in shipped runtime. | `src/graph-evidence-validation.mjs`; use `.citationExamples` only as independent numeric examples. Node-output verifier remains absent. |
| P2 recovery constraint | Unverifiable historical JSONB/filename-only SQL ledgers remain blocked. Current file hashes cannot authenticate historical execution. | Registry persistence and generic/Book migration runners. Independently verify old bytes or review a reconstruction plan; no automatic adoption. |
| P2 reproducibility carry-forward | No dependency lockfile; remote dependency resolution is not an immutable release attestation (original R06). | `package.json`, CI npm/pip installation. Not changed in this scoped integration. |
| P2 scope carry-forward | Original R09 incomplete full scientific-provider/product scope and R11 native-PDF OS isolation remain outside these three remediations. | Original integration audit. No claim of full Math Universe/host isolation completion. |
| P3 host qualification | Fixtures do not prove real NSSM install/reboot/rollback. Same-Root updater lock does not constrain manual admin edits or another Root targeting the same service. | Windows reports/runbooks. Separate supervised restricted-account host drill required. |
| P3 remote-state race | GitHub API observations are non-atomic; a rerun can begin after the final refresh. Pinned workflow IDs require reviewed maintenance. | `scripts/windows-deployment.ps1`; fail-closed fixtures/live smoke, no atomic remote guarantee. |

## GO / NO-GO and handoff

GO: submit this isolated integration result for independent review. No PR has been created; no integration plan is executed beyond the expressly authorized three feature merges and synthetic tests.

NO-GO: production deployment, real migration, service restart or cutover. CI is necessary evidence, not production authorization. Keep gate closed. Main, source fix branches, existing PRs1–9, repository settings, Cluster Grid and production database were not modified.

Rollback before any future deployment is simply abandoning this isolated branch; no production effect needs reversing. Do not reset or rewrite source histories. Future rollout/rollback requires its own reviewed immutable artifacts, authentication, source shutdown, verified backup/restore and host qualification.
