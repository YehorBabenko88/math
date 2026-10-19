# Math Universe on Windows: supervised deployment tooling

The UI can be served without PostgreSQL. Deployment qualification is stricter: the updater requires complete synthetic PostgreSQL and native PDF tests before activation. This tooling does not authorize installation or unattended deployment.

## Trusted tooling and prerequisites

Obtain a reviewed checkout at an exact approved commit. Keep `scripts/windows-update.ps1` and `scripts/windows-deployment.ps1` together from that same commit. If an administrator copies the updater outside the checkout, copy **both** files into the same fixed directory; never download and execute a helper at update time. The bootstrap's repository checkout already contains both files.

Use Node 22 or 24, Git and NSSM on PATH. The target host must permit the locally reviewed scripts under its existing execution policy. The updater does not bypass execution policy or modify security settings. Use a dedicated restricted service identity and separately approved service permissions.

`-Root` is normalized to an absolute path. The generated launcher resolves active.txt and releases relative to its own directory (`$PSScriptRoot`), including roots containing spaces and apostrophes. The default is `C:\ProgramData\MathUniverse`. The launcher and helper remain trusted administrator-managed tooling outside release worktrees.

## Check-only review

After separately obtaining and reviewing the tooling, an administrator can inspect a branch candidate with:

```powershell
& C:\MathUniverseSource\scripts\windows-update.ps1 -Root 'C:\Math Universe Pilot' -Branch 'reviewed-release-branch' -CheckOnly
```

Check-only performs Git fetch and read-only GitHub API calls and may create the root/repository/lock files. It does not install or restart a service. It requires no NSSM. An exclusive per-root file handle prevents overlapping cooperating updater instances, including check-only; it is released on normal exit or process termination. It does not protect against unrelated administrators manually writing the active pointer.

## Exact-SHA evidence

The gate pins repository `YehorBabenko88/math` and trusted workflow IDs/paths in `Get-RequiredDeploymentWorkflows`. It requires successful push workflows for the selected branch and exact SHA, with the latest activity/current attempt and exactly one successful current-attempt job per required context:

- PostgreSQL Integration: all four Node 22/24 × PostgreSQL 16/18 jobs and `Full CI coverage`.
- Book Ingestion Native PDF: `native-pdf`.
- Browser E2E: `chromium`.
- Validate Math Universe: `test` (the CI contract check).
- Windows Deployment Contracts: `Windows contracts / powershell` and `Windows contracts / pwsh`.

An old success cannot mask a newer failed, pending, cancelled or skipped run/attempt. Latest activity uses GitHub's `updated_at`, so a new attempt of an older run supersedes an earlier success of a newer-created run. Missing/invalid metadata and bounded-pagination overflow fail closed. Workflow IDs are tied to this repository; recreating a workflow requires a reviewed tooling change. The updater refreshes run selection after collecting jobs and repeats the entire gate immediately before activation. GitHub responses are snapshots: a run may change after the final response, so this is not an atomic remote certification or a substitute for branch protection and review.

## Supervised activation prerequisites

Installation remains a separately authorized administrator operation (`-Install`); it is not performed by these tests. Before any approved activation, prepare the candidate's dependencies and an isolated **disposable** local test database with user `math_test` and database name `math_universe_test` or `math_universe_integration`, running PostgreSQL 16 or 18. Set `MATH_UNIVERSE_TEST_DATABASE_URL` to that test target and `BOOK_INGESTION_PYTHON` to a Python runtime containing the pinned PDF requirements. Never point the test suite at application/production data. The updater runs `scripts/test-full-ci.mjs` in the exact candidate worktree and rejects missing prerequisites, skipped/todo/failed tests or an empty suite. It does not install dependencies or run migrations against an application database.

Only after tests and fresh CI verification does activation atomically replace active.txt, restart the service and poll loopback health. Restart failure or failed health restores the previous validated pointer **before** the rollback restart. Without a previous release it removes the candidate pointer and stops the service. Recovery failures are reported together with the original activation failure. The lock covers capture of the previous pointer, local tests, activation and rollback.

## Limits and rollout status

Synthetic AST/Pester fixtures do not qualify NSSM installation, service permissions, host reboot recovery, application readiness or real-host rollback. A supervised drill under the intended restricted account is still required. A successful health endpoint only proves the HTTP server is reachable; it does not identify the release or prove scientific worker readiness. No SYSTEM scheduled task or automatic update schedule is recommended or enabled by this procedure. Concurrent manual deployment and interrupted activation still require an operator recovery procedure. See [deployment safety report](windows-deployment-safety-report.md) for evidence and remaining limits.
