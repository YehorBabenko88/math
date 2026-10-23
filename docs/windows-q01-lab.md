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
hard timeout is not implemented. A PID-only `taskkill /T` check has a PID reuse
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
