# Offline G0 v2 preflight — design, implementation and acceptance

Base: PR83 exact HEAD `a7113b3f0ae18d21948f0a71db26ea3ab9636b7e`. Read together with `docs/audits/pr82-physical-g0v2/ADMISSION_DOSSIER.md`. This implements a bounded part of Gate A, not Gate B or C. No physical authorization is created. PR80–83 remain unchanged.

## Trust boundary and report

The verifier is `scripts/adminit-containment/offline-preflight.mjs`. It imports Node builtins only. Launch a separately reviewed, pinned copy in a fresh trusted Node process; running an untrusted verifier and asking it to hash itself is not independent verification. The program checks its own bytes against the reviewed source inventory, but this cannot retroactively establish bootstrap trust. Neither a caller-provided policy hash nor a local PASS is host/operator authentication.

The report has exactly these fields and no free text, source/runtime paths, native errors, SID, process identifiers, handles or token buffers:

```json
{"sourceHead":null,"sourceTree":null,"sourceBlobs":null,"policySha256":null,"schema":"math.g0.offline-preflight.v1","status":"BLOCKED","code":"ARGUMENTS","provenance":"PIN_MATCH_ONLY_NOT_ATTESTATION","authority":"NONE","admission":"BLOCKED","localExecute":false,"isolationConfirmed":false,"physicalCall":"NOT_AUTHORIZED"}
```

This is the default blocked record, not a qualification receipt. PASS additionally binds the validated source HEAD/tree, blob count and external policy SHA256; these four fields remain null on BLOCKED. No path is returned. Status is PASS or BLOCKED. Code is NONE, ARGUMENTS, POLICY, ROOT, RUNTIME, SOURCE, WORKER, REPARSE, TYPES, PARSER, COMPILE, or CLEANUP. PASS exits0; BLOCKED exits2. These exit semantics are preflight-only; they do not change the Token API producer/validator's mandatory exit2. The report never embeds source input, exceptions or compiler diagnostics. A preflight PASS is not a token observation, attestation, isolation result or permission to run anything.

## Exact source and policy contract

The CLI accepts only six positional flag/value arguments, in this order:

`--source <private-absolute-checkout> --policy <private-external-policy-file> --policy-sha256 <independently-reviewed-64-hex>`

No force/execute/retry/skip-source/DLL/collector/harness options exist. Entry detection handles path aliases; aliased execution cannot silently exit0 without a report, and a linked invocation path is refused by the preflight. This document does not authorize running the CLI on ADMINIT. Prepare and review policy offline first; physical use requires the separate existing approval process.

Policy is canonical UTF8 `JSON.stringify(policy) + "\n"` (no BOM, duplicate keys, indentation or extra fields), at most2MiB, hash-pinned separately. It must remain outside the source tree, including `.git`, after canonical Windows case/alias resolution. Do not commit private runtime paths or the private policy. Required structure:

- schema: `math.g0.offline-policy.v1`; repository: `YehorBabenko88/math`.
- head/tree: exact40-hex immutable Git identities, independently cross-checked with the approved GitHub objects.
- blobs: complete Git `ls-tree -r -z` inventory in Git order. Each entry has exactly path, mode, oid, sha256. Paths are repository-relative; modes100644/100755 only; oid is the Git blob object ID and sha256 covers the raw approved blob bytes. Submodules, symlinks, duplicate/case-colliding names, traversal and unsupported names fail closed.
- tools.node: private absolute path, sha256, exact `v22.x.y` or `v24.x.y` version. tools.git and tools.powershell: private absolute path and sha256. tools.compiler: sha256 of the independently approved Framework64 csc.exe. These are expected reviewed values, not values automatically trusted because this host reports them.

Obtain source pins using immutable objects in independent trusted custody; do not bless current worktree bytes as historical/source evidence. A reviewer can reproduce each blob SHA256 from `git --no-replace-objects cat-file blob <oid>` and the complete tree from the approved commit. The tests contain a synthetic policy builder, not a production approval generator. Runtime executable pins prove only byte matches to supplied expectations, not vendor identity or integrity of every OS/framework dependency.

Source must be a new clean standalone detached checkout below `%LOCALAPPDATA%\MathUniverseAdminitAcceptance`, not the root itself. Existing historical laboratories/source trees are never replaced. Linked worktrees, alternate/common Git stores, config includes, grafts, partial/promisor metadata and reparse/hardlink source/policy files are rejected. Windows runtime components may legitimately have WinSxS/package hardlinks: tool reads require stable file identity/link count and the approved full SHA256, rather than changing Windows files or requiring link count1. This is not an exclusivity/ACL guarantee. UNC/device path forms are refused. Git/common/object directories must resolve inside the standalone `.git`. Git global/system configuration, replacements, fsmonitor and lazy fetching are disabled for verifier reads; no Git status/clean filters or hooks are invoked.

All tracked files are independently enumerated and matched against both tree and staged index, then their raw bytes are checked using SHA256 and Git blob identity. Enumeration also rejects untracked **and ignored** files and unexpected empty directories. No source file is rewritten or EOL-normalized. Materialize exact raw approved blobs; Windows smudge/CRLF differences deliberately BLOCK rather than silently normalize. All source and tool checks repeat after compilation. File identity/size/time checks surround reads, but do not prove continuous custody against an active same-user adversary.

## Parser/compile-only worker

The Node process pins PowerShell/Git/Node executables before starting the worker. Child environment is a minimal allowlist; COR profiler, COMPLUS, DOTNET, DEVPATH, NODE startup, execution-policy overrides and arbitrary module/search variables are not inherited. PowerShell starts with NoProfile/NonInteractive and a fixed encoded script; only OS PowerShell modules are on its module path. Temporary/module-analysis-cache locations are placed in a newly created private-workflow scratch directory under the acceptance root.

The worker payload is bound to the SHA256 of the original serialized buffer in the encoded script. It is captured once, verified and then parsed, preventing post-write payload replacement from being accepted. No candidate script is dot-sourced or invoked. The worker checks generic Windows reparse attributes, current executable/compiler hashes, x64 Framework PowerShell5.1, and absence of any MathUniverse.G0 types in loaded **or reflection-only** assemblies.

PowerShell parsing uses ParseInput on captured, verified text for g0-token-api.ps1, observe-token-api.ps1 and collect-g0.ps1. C# compilation uses the fixed Framework Microsoft.CSharp.CSharpCodeProvider from the expected System assembly, not a machine-config-selectable provider factory. Output is a new library file in unique scratch: GenerateExecutable=false, GenerateInMemory=false, absolute references to the expected System/System.Core assemblies, fixed options and warnings treated as errors. Worker CWD is the fresh scratch directory, avoiding candidate/CWD assembly lookup. The worker never accesses CompilerResults.CompiledAssembly or loads/invokes the produced library. A second assembly/type check follows compilation. No .NET SDK installation is required. PowerShell7 is parser-tested only; it is not accepted as the Framework compiler runtime.

Worker stdout is one exact canonical fixed-enum record. Parent requires matching exit status, empty stderr and bounded output/time; malformed, duplicate-field, multiple-record, timeout and unexpected results BLOCK. There is no retry or alternate compiler/DLL fallback. Scratch cleanup removes only checked regular single-link files in the exact newly created directory; failure cannot become PASS. On timeout, compiler descendant termination/cleanup is **not qualified** and the result remains BLOCKED. No Job Object/native containment claim is made.

## Tests and RED/GREEN

Initial RED: preflight module absent. Additional review found and corrected three defects before publication: inherited CLR-profiler environment (P1), external Git metadata stores (P2), and Windows-case policy containment (P2). Negative regressions now cover those cases. A separate P2 entry-dispatch defect was reproduced: execution through a directory alias skipped the original ESM entry guard and exited0 without JSON. Canonical entry matching plus an invocation-link refusal fixes it; the regression requires an explicit BLOCKED report. No native profiler was loaded to test this; environment handling is tested as pure data.

Core negatives cover replacement/missing source, wrong HEAD/tree, staged-index drift, attached HEAD, ignored/untracked files, unexpected directory, hardlinks/directory links, source metadata redirection, malformed/private worker reports, unsupported policy, runtime hash mismatch, preloaded synthetic namesake type, parser/compile errors and CLI bypass flags. A harmless dummy type tests the loaded-type refusal; the actual candidate adapter is never loaded. Both PS5.1/7 parse the fixed worker without invoking it in the parser-only cases. Framework tests compile the actual source to disk without loading the assembly.

The seven-file bounded CI inventory is explicit in the scoped workflow. It includes new preflight tests and pure v1/v2/CLI/wiring/flags/scope contracts, **not** the older adapter-loading Add-Type/fault suite. Those source files are unchanged, but their prior success is not counted as execution in this task. No full npm suite, physical Token API, native G1, database or stress test is run.

One end-to-end CLI fixture runs **only on disposable hosted Windows**: it creates an isolated synthetic standalone repository and external pins, checks a real compile-only preflight PASS and negative source/tree/runtime pins, and verifies all admission fields stay closed. It never calls the adapter. Local and Linux runs explicitly SKIP this hosted case; other Windows-only checks are SKIP on Linux. Skips are NOT_RUN, not evidence of qualification.

Local Node22.23.3 and Node24.20.0: each33 tests,32 PASS,0 FAIL,1 hosted-only SKIP. Expected disposable hosted Windows:33 PASS/0 FAIL/0 SKIP; Linux:28 PASS/0 FAIL/5 Windows-only SKIP. Exact-head hosted jobs/counts and private log SHA256 must be independently inspected after push and published in the Draft PR. Git diff --check and tracked evidence publication policy are required. Hash manifests identify private test transcripts without publishing their contents or claiming independent attestation.

## Admission limits and next step

This is offline application logic: no HTTP client, remote Git command, service/database query, Token API call, collector invocation or native harness. It does not establish that OS filesystem providers cannot hydrate remote files, that all runtime/OS dependencies are trustworthy, that the host is Medium/non-elevated, or that enforcement is continuous. Runtime pin checks and same-account hashes are not independent host attestation. Reparse/drift checks before/after cannot exclude malicious swap-and-restore races. Effective file/network/IPv4+IPv6 loopback isolation, source/observer custody, real ABI/error/cleanup behavior and the historical E_QUERY cause remain unqualified.

Future offline use requires independent review of the exact candidate and private source/runtime policy. Any subsequent physical token observation requires a separate fresh process and explicit operator approval after that review. No PASS changes Gate B/C, authorizes a retry, or opens Execute/G1.

Q01 OPEN · Physical G1 BLOCKED · Production NO-GO · Book gate CLOSED. authority=NONE, admission=BLOCKED, localExecute=false, isolationConfirmed=false.
