# Independent Windows / PostgreSQL review — PR #31

Candidate HEAD: `cb168925b5aeec0c957137dd94ab72c64f0bd333`; declared tree `10cfd29f5d2c75e841d88dd70bef8773dada8287` (tree independently unverified through connector).
Source PRs: #23, #25, #29. Integration PR: #31. This branch is an isolated review descendant, not a modification of the integration branch.

## Inspected source
- `scripts/q01-lab/WindowsJobContainment.cs`: dormant API, suspended creation, assignment before resume, kill-on-close flag, handle-based termination/cleanup. Native behavior not exercised.
- `tests/windows-job-containment.mock.ps1`: seven existing mock sequences; this audit adds two more exception paths (exit-code query failure and wait failure).
- `scripts/windows-q01-lab.ps1`: explicit execute gate throws before any lab execution; preflight is read-only. No physical authorization.
- `scripts/windows-deployment.ps1`: nonempty unique required-context precondition and provenance checks from #25.
- `tests/postgres-lease-clock-live.test.mjs`: recursive blocking chain witness and isolated PostgreSQL fixture from #29; code reviewed, not executed locally.

## Priority / evidence
- **P0 / BLOCKED**: native Windows descendant containment, nested Job Object behavior, owner-crash cleanup, and filesystem confinement not proven by mock tests. Job Objects are not filesystem sandboxes. No physical execution authorized.
- **P1 / REVIEW**: cleanup must be fail-closed when wait/exit-code retrieval throws; added deterministic mock regressions. New tests NOT_RUN pending exact-SHA hosted results.
- **P1 / BLOCKED**: PostgreSQL lock-chain evidence requires exact-head PG16/18 run logs, zero skips, and witness path proof. A green workflow alone is insufficient.
- **P2 / REVIEW**: required-context policy is checked for empty, whitespace and duplicates; verify both PowerShell 5.1 and pwsh hosted jobs on exact integration tree.

## CI snapshot at review
At candidate HEAD, Book Ingestion Native PDF, Experimental Proof Kernel, Validate Math Universe and Browser E2E were SUCCESS; Windows Deployment Contracts and PostgreSQL Integration were IN_PROGRESS; Q01 Windows Containment Preparation, Detached Journal Regression, Queue Reliability and Diagnostic were QUEUED. These are transient observations, not a final aggregate acceptance.

## Acceptance
Q01 OPEN. Production NO-GO. No merge, deployment, production DB changes, physical host operations, or native containment trials. The only proposed patch is test-only and must not be represented as proof of runtime safety.

## Follow-up 2026-10-25: fault cleanup and CI provenance

Added native-free fake-kernel exception coverage for CreateJob, Close(thread), and TerminateProcess failure. The TerminateProcess case asserts all owned handles are still closed through nested finally blocks. This tests sequencing, not OS-level termination or descendant drain. These new tests are NOT_RUN at this audit HEAD.

Candidate exact-SHA workflow observations: at `cb168925b5aeec0c957137dd94ab72c64f0bd333`, Windows Deployment Contracts, Book Ingestion Native PDF, Experimental Proof Kernel, Validate Math Universe, QA SQLite Q01 Diagnostic, Q01 Detached Journal Regression, Browser E2E, and AI Orchestrator Policy were completed SUCCESS; PostgreSQL Integration, Q01 Windows Containment Preparation, and Q01 Queue Reliability were still QUEUED at the follow-up read. Do not attribute these source-HEAD outcomes to this audit branch.

Audit branch commit `3a8269e23bf8b78c73c438d530aff1d8a671da1e` had seven queued workflows. Until exact-HEAD jobs and TAP/Pester assertions are inspected, this branch's acceptance remains BLOCKED.

## Native Job Object acceptance criteria (design only; gate CLOSED)

1. Prove `CREATE_SUSPENDED` and `AssignProcessToJobObject` complete before any `ResumeThread`, including errors and nested-job refusal.
2. Confirm `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` with actual descendants: closing the **last** job handle terminates all assigned processes. Confirm no leaked inheritable or duplicate handles. Do not infer this from fake-kernel sequencing.
3. On deadline, verify root and descendants have exited using handle-based waits and job accounting; no PID-only cleanup, no PID-reuse race, no unbounded hang. Check timeout vs `WAIT_FAILED` distinction.
4. On owner crash, verify OS closes the last owned handle and descendants terminate; verify orphan processes and inherited handles independently.
5. Verify restricted child environment, command-line quoting, current-directory and executable canonicality, ACLs, reparse points, junctions, hard links and race windows. Job Objects alone do not confine filesystem access.
6. Prove that error paths in `CreateJob`, `ConfigureKillOnClose`, `CreateSuspended`, `Assign`, `Resume`, `Wait`, `ExitCode`, `TerminateJob`, `TerminateProcess`, and each `Close` do not silently mark containment successful.
7. Every result must bind exact SHA/tree, OS build, PowerShell 5.1/pwsh version, architecture, C# compiler/runtime, PID/handle inventory, fixture digest, timestamps, and signed evidence manifest. Explicit NOT_RUN/BLOCKED are not PASS.

**Safety:** these are future acceptance criteria, not authorization. No native Job Object, physical host, deployment or production DB tests executed in this audit.

## PostgreSQL witness acceptance criteria

- Test both PostgreSQL 16 and 18 against disposable, independently named databases, not shared production roles or schemas.
- Record every backend PID and exact `pg_blocking_pids` edge. Recursive chain must terminate at the intended fixture and contain no cycles.
- Prove lock wait is active before lease expiry, and expiration is determined by PostgreSQL clock after the wait starts.
- Confirm `JOB_LEASE_LOST` for each fenced operation and no state mutation, plus successful fresh-owner claim with stale-token rejection.
- Preserve existing advisory/row/protocol-row/interposed variants, zero skips, no assertion weakening or automatic retry.

Audit HEAD after additional mock coverage requires new exact-HEAD CI. Q01 OPEN; production NO-GO.
