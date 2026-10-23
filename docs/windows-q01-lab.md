# Windows Q01 laboratory safety entry point

`scripts/windows-q01-lab.ps1` targets Windows PowerShell 5.1 and an existing Node
22 or 24 executable. It never installs software or requests elevation. `Source`
and `ExpectedHead` (a full 40-character Git SHA) are required for preflight.
Profiles are `quick` (default), `fault`, and `stress`.

From a **non-elevated** PowerShell session, read-only preparation is:

```powershell
powershell.exe -NoProfile -File scripts/windows-q01-lab.ps1 `
  -Source 'C:\absolute\checkout' -ExpectedHead '<full immutable SHA>' -Profile quick
```

The output is `PREPARED` only when identity, literal path, HEAD, Node version,
and read-only source snapshot guards pass. It creates no files or directories.
`PREPARED` is not a successful queue run, physical ADMIN PC acceptance, or
permission to execute. All policy violations return `BLOCKED` and exit code 2.

## Execution gate: currently BLOCKED

`-Execute` is reserved for a separately authorized laboratory run. The switch
cannot establish that user authorization exists. **The current implementation
always blocks execution before creating a directory or starting a queue.**
Windows Job Object containment with inherited child ownership and a guaranteed
hard timeout is not independently accepted or enabled. A PID-only `taskkill /T` check has a PID reuse
race; this runner does not advertise that as verified containment. Do not remove
the fail-closed gate until containment, timeout cleanup, and fixtures are reviewed.

The intended future harness interface is:

```text
node scripts/q01-lab/run.mjs --source <checkout> --output <fresh run UUID directory> --expected-head <SHA> --profile <profile> --lab-admin-pc
```

Only `C:\Users\Administrator\AppData\Local\MathUniverseLab` may receive runtime
writes. There is no root override. Future child-only TEMP/TMP and working
directories must be inside a fresh run directory under that root. Reparse points,
junctions, symbolic links, file hardlinks, aliases, and traversal must be rejected.
The source must remain read-only and have matching snapshots before and after.
No source copying, system settings, persistent environment changes, services,
PostgreSQL, Grid, MetaScalp, credentials, network operations, or package installs
are authorized by this entry point.

## Guard verification only

```powershell
Invoke-Pester tests/windows-q01-lab.Tests.ps1 -EnableExit
```

These fixtures mock identity, reparse metadata, and Git results; they do not make
real links, change rights, invoke a queue, or establish physical machine behavior.
They cover elevation, outside-root and alias/traversal paths, reparse ancestors,
wrong HEAD, and mismatched source snapshots. Execution remains BLOCKED regardless
of fixture results. No physical laboratory run has been performed.

## Dormant containment preparation (issue 20)

`scripts/q01-lab/WindowsJobContainment.cs` is deliberately neither compiled nor
called by either execution entry point. Its candidate ownership sequence is an
unnamed, non-inheritable job configured with kill-on-close, a non-inheriting
`CreateProcess` with `CREATE_SUSPENDED`, assignment to that job, then resume.
No breakaway flag is requested. Assignment failure kills the suspended process
through its owned handle. Cleanup always attempts to close thread, process, and
job handles, even when another cleanup step fails. The job is terminated on normal
root exit too, so root exit does not intentionally leave descendants running.

The candidate restricts working directory to an existing literal descendant of
the fixed lab root, rejects reparse ancestors, and constructs a child-only
environment containing SystemRoot, WINDIR, TEMP, and TMP. It accepts an explicit
absolute executable and argument array (Windows quoting, no shell). It bounds
the root wait by the requested 1..3600000 millisecond deadline and cleanup wait
by 5000 milliseconds. It never creates directories or writes source files.

These are code-level properties, not host acceptance. A Job Object is not a
filesystem or network sandbox. Path checks have a validation/use race and do not
prove immutable directories or source bytes. Native API calls themselves are not
an external watchdog, and descendant termination/drain is not independently
observed. Nested-job behavior, owner crash, grandchildren, failed assignment,
timeout, command-line/environment fidelity, and complete descendant cleanup all
still require independently authorized synthetic Windows acceptance. The harness
is not wired to this helper; no physical ADMINPC/LS5PC4 test is authorized or run.
Production and physical execution remain **NO-GO / BLOCKED**.

Native-free preparation checks:

```text
node --test tests/windows-job-containment.test.mjs
pwsh -NoProfile -File tests/windows-job-containment.mock.ps1
```

The mock fixture compiles C# together with a fake kernel and tests seven ownership
and cleanup sequences without constructing the Windows native backend. This is
not evidence that the Windows kernel enforces the candidate guarantees.
