# PR31 isolated hosted Windows containment harness

Base SOURCE_HEAD `cb168925b5aeec0c957137dd94ab72c64f0bd333`, tree
`10cfd29f5d2c75e841d88dd70bef8773dada8287`.

The candidate terminated the job then closed handles without confirming zero
active descendants. A local injected-kernel RED expected `kill-job,drain` and
observed `kill-job,close`. The minimal fix queries JobObjectBasicAccountingInformation
until ActiveProcesses is zero, with the existing five-second cleanup bound;
query failure or elapsed deadline throws BLOCKED. The fake suite covers normal
root exit, timeout, assignment rejection, cleanup errors and unconfirmed drain.

Core mechanics are tested separately from physical execution policy. The fixed
.NET synthetic fixture is compiled locally when an SDK exists; native invocation
is restricted to disposable GitHub-hosted Windows. It calls internal RunOwned
from the same test assembly, without changing public Run's literal physical lab
path policy. Test-only dispatch accepts fixed fixture modes, never arbitrary
shell, executable, book, queue or production commands. It tests assignment before
resume with membership checks, root exit with a live descendant, timeout and
zero-active drain, assignment rejection before any fixture execution, environment
and argument fidelity, owner crash/kill-on-close, public outside-path rejection,
and the existing reparse validator against an owned temporary symbolic link.
An independent PowerShell parent limits the entire fixture supervisor to 90 seconds;
the job also has an eight-minute timeout. Exact source head/tree and per-case
PASS/FAIL evidence are retained as immutable-SHA-pinned artifact workflow output.

The public PowerShell `-Execute` gate remains unconditionally closed. Hosted
mechanics acceptance does not authorize G1, ADMINPC/LS5PC4, physical execution,
production access, deployment, or a merge. A Job Object is not a filesystem or
network sandbox; cwd/TEMP checks do not prevent external writes. Path checks have
validation/use races and the harness does not assert hostile-code sandboxing.

Local evidence: the mock regression was RED before the change and GREEN after it;
three Node static contracts pass. No native API was invoked locally. The local
machine has a .NET runtime but no SDK, so full fixture compilation and native
results depend on hosted execution. Report hosted SOURCE_HEAD/tree and artifact
results separately; an absent, skipped, or failed job is not acceptance.
