# Issue 20: Windows containment preparation audit

Base: `20ede51c6e5eddbf49fde709f8af5e77a319e1c7`.
Branch: `feat/q01-windows-job-containment`.
Scope: dormant containment candidate, native-free fixtures, documentation and a
dedicated hosted preparation workflow. No source queue behavior was changed.

| Gate | Result | Evidence and limit |
| --- | --- | --- |
| Closed execution gates | PASS, static | PowerShell still unconditionally throws for Execute; Node lab gate unchanged. Helper is not loaded or invoked by either entry point. |
| Suspended ownership sequence | PASS, mock | Candidate configures kill-on-close before suspended creation, assigns before resume, and uses owned handles for cleanup. Seven fake-kernel scenarios check call ordering. |
| Compile compatibility | PASS, local compile | C# Add-Type compile only under Windows PowerShell 5.1 and existing pwsh. No native backend construction or native call. |
| Native-free static tests | PASS, local | Two Node tests, including closed entry-point check. Initial absent-helper RED was observed before implementation. |
| PowerShell 5.1 fixture script | BLOCKED, local | Existing host execution policy rejects File invocation. Policy was not changed or bypassed. Existing pwsh ran the fake fixture successfully. |
| Hosted matrix | BLOCKED, pending | Dedicated pinned workflow prepares PowerShell 5.1/pwsh and Node 22/24 combinations. No hosted result is claimed by this report. |
| Real Job Object enforcement | BLOCKED | No native kernel/process containment trial performed. |
| Complete descendant drain | NOT PROVEN / BLOCKED | Candidate terminates the job and closes its owner handle; independent active-process/drain observation is absent. Root exit is not descendant drain proof. |
| Physical ADMINPC/LS5PC4 and production | NO-GO | Not authorized, not tested, not enabled. |

The dedicated workflow only compiles the candidate with an injected fake kernel
and reads source for static checks. It does not invoke a queue, construct the
native backend, perform real containment tests, install a test framework, or
modify execution policy. Hosted success would establish fixture compatibility
only. It would not establish physical host acceptance or kernel containment.

## Candidate code properties and remaining risks

`Containment.Run` checks an existing literal working-directory descendant of the
fixed lab root and rejects reparse ancestors. It validates an existing absolute
executable. `RunOwned` owns an unnamed non-inheritable job handle, suspended root
process/thread handles, and cleanup. `WindowsJobKernel` requests no breakaway and
does not inherit handles into the child. The child receives only SystemRoot,
WINDIR, TEMP and TMP. Explicit arguments use Windows command-line quoting.

The root wait has a requested deadline capped at one hour; failure cleanup has a
five-second root wait. These do not prove a wall-clock hard deadline for blocking
native calls. An independently supervised owner/watchdog and real failure
acceptance remain outstanding. Nested job restrictions, assignment rejection,
owner crash, grandchildren, timeout, environment/quoting fidelity, and complete
descendant termination require separately authorized Windows synthetic fixtures.

A Job Object is **not a filesystem sandbox** or network sandbox. Setting cwd and
TEMP/TMP inside the lab does not constrain arbitrary executable writes. Literal
path and reparse checks have a validation/use race; directory immutability,
executable/source identity and hardlink policy require broader acceptance before
wiring the helper to the harness. The helper itself neither creates a fresh lab
directory nor carries out pre/post source verification; the disabled entry point
must retain those responsibilities when future reviewed integration is permitted.

No physical host test, deployment, machine-setting change, package installation,
credential handling, or execution-policy bypass was performed. Both gates stay
closed regardless of fixture results.
