# Current integration note

This is the historical PR44 design/evidence snapshot. Current candidate instructions are in MATH_ADMINIT_INTEGRATION_ACCEPTANCE.md. Active new root is MathUniverseAdminitAcceptance; do not stage or inspect historical MathUniverseLab. Current public local evidence is hash-only; original raw evidence remains in source history/local retention. No local Execute is authorized.

# ADMINIT synthetic Job Object harness — admission report

Base PR41 exact HEAD `280096ab24ce4f32cdaf17bd4a928f66f4f2dbda`. This branch does not modify the original hosted-only NativeHarness.cs, its workflow or WindowsJobContainment.cs. No ADMINIT/ADMIN PC, LS5, PC4, service, production database, deployment, Q01 G1 or physical native execution was performed.

## Design and current decision

**ADMINIT native execution BLOCKED_PENDING_ISOLATION_REVIEW. Q01 OPEN. G1 BLOCKED. Production NO-GO.** The user confirms isolation is already configured and will supply verifiable criteria. That is not yet evidence of the effective policy. Neither a string, switch nor an environment variable is accepted as that policy verification. There is no local unlock option in this revision: PowerShell -Execute throws before reading the package or launching anything; the synthetic EXE also refuses ADMINIT. Removing those guards requires a separately reviewed implementation of the supplied conditions, not editing a receipt or setting GITHUB_ACTIONS.

The new fixed .NET Framework console executable is compiled by Windows PowerShell5.1 Add-Type. No SDK, dotnet, NuGet or installation is required on ADMINIT. Only AdminitSyntheticHarness.exe and package.json ship in the exact package. The already-installed full CLR4 Framework component System.Web.Extensions is required; no installation fallback is allowed. A separate hosted-only restricted-token bootstrap is NOT shipped. The new harness and existing hosted-only harness are separate files; the old guard is not relaxed.

A fixed supervisor owns a kill-on-close outer job for each fixed owner. The owner creates an inner kill-on-close job and root suspended, assigns it and verifies membership before Resume. The root creates leaf suspended; the owner captures its process identity/handle and verifies membership in the specific inner job before releasing the leaf-resume barrier. No process is selected for termination by PID alone. PID plus exact creation FILETIME is validated when opening an observer handle; identity remains pinned by that handle. FILETIME is serialized as decimal text, avoiding JSON double precision loss.

Five scenarios: normal root-exit/descendant drain; deadline/timeout; owner crash/inner kill-on-close; native assignment rejection using an invalid job handle while the child remains suspended; and injected cleanup-confirmation rejection after an actual native drain. Assignment injection records the actual Win32 error. Cleanup PASS means the expected fail-closed rejection was observed, not that failed cleanup was ignored. The observer holds process handles and an outer supervisory job, never an inner job handle that would keep the owner-crash target alive.

Independent bounds: owner wait25seconds; job-drain5seconds; process-handle termination waits5seconds; fixed bootstrap whole-suite deadline120seconds; independent PowerShell watcher150seconds; workflow10minutes. A watcher kill, missing report, blocked token, assignment error outside its intended case, unconfirmed cleanup or absent case is not PASS. A fixed workload Sleep is only a synthetic liveness hold; synchronization uses suspended state, membership checks, atomic identity files and barriers.

## Security boundaries

Native suite checks TokenElevation=0 and actual TokenIntegrityLevel RID8192; it records measured token/SID/PID evidence. Hosted Windows can start elevated, so the hosted-only bootstrap creates a restricted copy of its own token and sets Medium integrity, then launches the fixed supervisor suspended into its own job. It does not change UAC, Execution Policy, firewall, ACLs, services or persistent privileges. There is no logon/credential fallback or manual privilege enabling. If Windows rejects restricted creation, the native job is BLOCKED. See Microsoft [restricted tokens](https://learn.microsoft.com/en-us/windows/win32/secauthz/restricted-tokens) and [CreateProcessAsUser](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessasuserw); the API itself may temporarily enable available required privileges in its hosted caller.

**Job Objects are process lifetime/resource controls, not filesystem/network/database isolation.** The fixture exposes no arbitrary executable/shell command/input, database client, service API or network client. Child environments are explicitly constructed; production/Node/PG environment variables are not inherited. Writes use only fixed names in fresh owned synthetic directories. This trusted-code allowlist is not a hostile-code sandbox or proof of production reachability denial. No production connectivity test is attempted. Network/account/project-access isolation must be independently established; the local gate stays closed until then.

Package verification requires out-of-band manifest SHA256 and expected exact source HEAD, two-file inventory, source tree, unchanged policy, bounded files, per-file size/SHA256, no reparse or hardlinks. Read-only PowerShell verification additionally confines package paths to `%LOCALAPPDATA%\MathUniverseLab\AdminitSynthetic`, checks literal spelling, ancestor reparse status, directory ownership and writable-principal policy. It never sets ACLs. The native supervisor additionally measures actual laboratory owner/writers/SDDL hash before any case owner starts, and case processes recheck their own directory. Compilation uses committed regular Git blob snapshots after fsck/source verification and fixed absolute OS Framework references, avoiding untracked input or current-directory DLL substitution. These are point-in-time file checks, not protection against a malicious same-user race. Authenticate the auditor kit separately before invoking it; a validator cannot authenticate its own modified source. Package metadata and test JSON are producer reports, not independent attestations.

## Local verification (no native suite execution)

- Framework EXE + hosted bootstrap compiled together with the unchanged helper using PowerShell5.1/Add-Type; neither EXE invoked.
- Pure Node22/24 static/package/native-evidence policy tests run; exact counts and byte-exact RED/GREEN evidence are retained with SHA256.
- Package RED3FAIL before verifier; native-evidence validator RED1PASS/9FAIL before validation; array-valued tree RED7PASS/1FAIL, then rejected by strict type validation.
- Mock/AST guard proves local -Execute fails closed before filesystem/native effects. No Execution Policy bypass or modification.
- Existing helper and original hosted fixture content hashes pinned by tests; Git blobs must remain unchanged.

Native hosted PASS/FAIL/BLOCKED is reported in the Draft PR against its exact final HEAD after the workflow executes. A queued, cancelled, skipped or absent job is NOT_RUN/BLOCKED, never native PASS. Package artifacts do not by themselves authorize use.

## Future ADMINIT command packet — verify-only, NOT execution authorization

Do not run this packet until the exact hosted run/package and auditor kit have independently passed review and separate local synthetic permission is given. The source SHA, package digest and trusted-kit location must come from that review, never from the untrusted package being checked. No package is usable while native CI or isolation evidence is missing.

Prerequisites: operator has staged the exact approved two-file package in a fresh, existing, empty-before-extraction owned laboratory descendant; approved ZIP digest/inventory must be checked before extraction (only the two literal filenames, no directory/traversal/link entries). No automatic download or arbitrary archive extraction is supplied here. Do not install or change permissions to work around a refusal.

```powershell
# Documentation only. Replace review placeholders; they intentionally fail closed.
$ExpectedHead = '<exact reviewed feature HEAD>'
$ExpectedManifestSha256 = '<SHA256 from verified hosted build identity>'
$Kit = 'C:\APPROVED_READONLY_NEW_FEATURE_CHECKOUT'
$Package = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MathUniverseLab\AdminitSynthetic\approved-package'
whoami
$PSVersionTable.PSVersion
Get-ExecutionPolicy -List
& git --no-optional-locks --no-replace-objects -C $Kit rev-parse HEAD
& git --no-optional-locks --no-replace-objects -C $Kit status --porcelain=v1 --untracked-files=no
# Authenticate the kit and its tracked bytes independently before script invocation.
& (Join-Path $Kit 'scripts\adminit-containment\verify-adminit.ps1') -PackageRoot $Package -ExpectedManifestSha256 $ExpectedManifestSha256 -ExpectedSourceHead $ExpectedHead
# No -Execute, no EXE invocation. A policy refusal is BLOCKED; do not bypass it.
```

This is intentionally not an executable local native-run packet yet. A precise Execute command cannot safely be issued until the promised isolation conditions are supplied, mapped to real verification, accepted, and hosted native qualification passes. Existing PR41 source copies do not contain this new kit; do not silently overwrite them.

## Required ADMINIT admission evidence

1. Exact machine identity and dedicated account SID, actual non-elevated Medium token, approved package/source/kit hashes and trusted delivery provenance.
2. Existing effective network isolation criteria and independently collected read-only evidence; no live production probes. Include scope, authority, expiry and failure policy.
3. Existing effective permissions denying other projects/production resources, owned lab root/subdirectories, no writable untrusted ancestors/reparse/hardlinks, source checkout immutable during the run. No ACL changes by harness.
4. Separately approved external isolation verifier/provisioning mechanism; caller booleans, filenames or plaintext confirmation cannot stand in for proof.
5. All five disposable-hosted native cases PASS on exact SHA, complete PID/creation-time/handle/drain evidence, package/ZIP SHA256 validation, independent watchdog/failure acceptance and explicit local synthetic authorization.

Until all are verified: local Execute CLOSED, physical G1 BLOCKED. Even after a future synthetic admission, Q01 acceptance and any G1/production action require their own authorization.
