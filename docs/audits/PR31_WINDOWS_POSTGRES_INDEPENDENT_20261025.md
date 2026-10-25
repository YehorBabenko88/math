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
