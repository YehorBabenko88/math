# Windows deployment safety remediation (R01 / R05 / R12)

Scope: `fix/windows-deployment-safety`, based on `740f35742aa585f67471edea2fab5f5205a321f6`. The audit at `22c0b51` was read only. No other fix branch is included. No service, NSSM command, installation, scheduled task, security setting, production database or protected branch was changed.

## Reproduction and design

R01: parse-only reproduction returned exactly five native parser errors in the original updater: `TerminatorExpectedAtEndOfString` line 75; `MissingEndParenthesisAfterStatement` line 88; `MissingEndCurlyBrace` lines 74 and 23; `MissingCatchOrFinally` line 88. The corrupted catch/regex/finally is replaced with a structured activation/rollback helper. AST parsing is a fixture and a dedicated Windows CI check.

R05: `Assert-DeploymentChecks` in `scripts/windows-deployment.ps1` pins trusted repository/workflow IDs and paths, checks exact SHA/branch/push identity, chooses latest `updated_at` activity/current attempt, requires all four PostgreSQL matrix jobs plus aggregate, Native PDF, Browser and Validate job contexts, and rejects missing/non-success/stale-attempt/duplicate jobs. Later reruns of older run numbers supersede older green activity; ambiguous timestamp ties containing non-green attempts fail closed. Malformed run metadata and incomplete API pagination fail closed. The updater gathers jobs via current-attempt endpoints, rechecks each run, refreshes newest-run selection using only cached evidence for identical run/attempt identities, and repeats the gate immediately before activation. It runs the existing unfiltered strict runner locally, requiring disposable DB/PDF prerequisites and zero skips/todo. No remote script or credential is obtained or executed by the gate.

R12: the generated launcher uses its own `$PSScriptRoot`, so active.txt and releases resolve under the configured custom Root without inserting user path text into executable code. Custom spaces/apostrophe paths and invalid pointer rejection have real temporary-file fixtures.

Safe rollback: a per-root exclusive file handle serializes cooperating updater invocations from previous-pointer capture through activation/recovery; process termination releases the OS lock. Same-volume pointer replacement is atomic and never truncates known-good bytes on failed replacement. Fixtures hold the pointer open exclusively to prove replacement failure preserves its previous content and removes temporary files. Activation delegates are injected: healthy activation, restart failure, failed health, first-release cleanup/stop, pointer-write failure and recovery-error reporting run without NSSM/service/HTTP effects. The previous pointer is restored before the rollback restart; recovery failure preserves both diagnostic messages. Updated docs require the matching trusted updater/helper pair and remove unattended SYSTEM/bypass instructions.

## RED / GREEN and local validation

Evidence logs are outside Git under the parent clone's `outputs/fix-windows-*` paths.

- `fix-windows-parser-red.json`: five exact original errors. `fix-windows-pester-red.log`: AST assertion failed with 5 errors before implementation.
- `fix-windows-gate-red.log`: newer activity on an older run and malformed metadata regressions failed before fixing selection/validation.
- `fix-windows-lock-red.log`, `fix-windows-pointer-red.log`, `fix-windows-timestamp-red.log`: exclusive-lock, atomic-pointer and ambiguous-timestamp regressions demonstrated RED before implementation.
- `fix-windows-pester-green.log`: **22 passed, 0 failed/skipped/pending/inconclusive**, normal PowerShell 7 with installed Pester 3.4.0. Pester 3's `Should Throw` is incompatible with the available PowerShell 7, so fixtures explicitly catch and assert exceptions with `Should Be` instead; an isolated framework probe reproduced that incompatibility.
- `fix-windows-parser-green-ps51.log`: Windows PowerShell 5.1 native parser, **zero errors in all three shipped .ps1 scripts**. Local PS5 Pester file execution was blocked by the existing execution policy (`running scripts is disabled on this system`); no bypass or policy change was used. CI exercises the same fixtures in stock Windows PowerShell and pwsh.
- `node scripts/test-full-ci.mjs`: **372/372 passed in each of all four cells**, Node **22.23.3 / 24.20.0** × PostgreSQL **16 / 18**; **zero fail/cancelled/skip/todo**, 360 test files, no exclusions. Databases were existing shared disposable loopback clusters; tests used their own UUID schemas and did not stop or reconfigure clusters.
- Native PDF command matching CI (`node --test tests/book-ingestion*.test.mjs tests/book-sqlite-text.test.mjs`, explicit file expansion on Windows): **76/76 passed**, no skip/todo.
- Browser: external temporary runner/config on unique port **4175**, **14/14 passed**, **retries 0**; no repository Playwright config change.
- `git diff --check`: no whitespace errors.

## Remote validation

The branch is pushed normally to its own remote ref; no PR is created and no branch is merged. Remote Actions and real GitHub response smoke evidence are recorded in the final handoff after workflows finish. The smoke imports only the reviewed deployment-contract helper and reads run/job JSON with `gh api`; it never invokes the updater or service operations.

## Limits and remaining qualification

Confirmed fixes cover syntax, pure/injected gate and rollback behavior, and custom-root launcher path selection. The Windows CI job is unconditional/read-only with pinned Pester 3.4.0 and no test retries or exclusions. GitHub API results are non-atomic snapshots; even final refresh cannot prevent a remote rerun immediately afterward. A gate success is not proof of branch protection, code review or production readiness. Workflow recreation requires reviewed updates to the pinned IDs. The gate accepts push activity only and fails closed for an untrusted latest event/branch.

Synthetic fixtures and CI do not prove real NSSM installation, restart semantics, service privileges, reboot recovery or deployed application readiness. The health check only proves loopback HTTP reachability, not release identity or scientific subsystem readiness. The file lock protects cooperating updater instances using the same normalized Root, not manual administrator writes, another root targeting the same service, or crash recovery across an interrupted activation. Service installation/configuration failure occurs before pointer activation but can still leave partially installed service metadata and needs an administrator procedure. Candidate dependencies/disposable test DB/PDF runtime must be prepared separately; the updater fails closed without them. A separately authorized supervised restricted-account host/rollback drill remains mandatory; deployment and automatic updates remain unqualified.
