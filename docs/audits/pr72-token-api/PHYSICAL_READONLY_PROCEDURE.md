# Future limited physical Token API check — NOT AUTHORIZED BY THIS DOCUMENT

1. Independently accept the exact successor HEAD/tree, source-byte/package manifest and observer/tool provenance. Stage a separate fresh checkout; preserve PR72 and historical laboratories. Keep effective filesystem/network/loopback isolation and G1 decisions separate.
2. Obtain explicit approval for ONE current-process read-only Token API observation. No native synthetic EXE, child-tree/Job Object test, DB/service query or Q01 run is included. Use a fresh non-elevated PowerShell5.1 process (or separately approved7), NoProfile, no policy bypass; no preloaded adapter types.
3. Inspect WindowsTokenObservation.cs, g0-token-api.ps1, observe-token-api.ps1 and token-contract.mjs against the independently accepted package. Compile errors or unavailable Add-Type mean UNKNOWN/BLOCKED, not permission to install/modify settings.
4. Only after approval, the following template captures the producer result and preserves its exit code before validation. Replace the literal checkout placeholder with the separately accepted new checkout; this is not an instruction to run it now.

```powershell
$Checkout = '<independently accepted new checkout>'
$Ps = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$Node = 'C:\Program Files\nodejs\node.exe'
$Json = & $Ps -NoLogo -NoProfile -NonInteractive -File (Join-Path $Checkout 'scripts\adminit-containment\observe-token-api.ps1')
$ProducerExit = $LASTEXITCODE
if ($ProducerExit -ne 2) { throw 'TOKEN_PRODUCER_BLOCKED' }
$Json | & $Node (Join-Path $Checkout 'scripts\adminit-containment\token-contract.mjs')
$ReviewExit = $LASTEXITCODE
if ($ReviewExit -ne 2) { throw 'TOKEN_REVIEW_BLOCKED' }
```

5. Exit2 is deliberate and not a success code. Inspect the strict structured output: a narrowly correct Medium/non-elevated/non-admin result may say status PASS, but authority must remain NONE, isolationConfirmed false, localExecute false and admission BLOCKED. UNKNOWN means stop and retain fixed codes. Do not invoke whoami/CSV as a PASS fallback, reuse old evidence or combine records from different processes.
6. Retain the normalized JSON and source/procedure identity in an independently controlled private evidence channel. Public summaries may include only accepted enum/numeric fields and review scope; no SID/handles/paths/raw buffers/compiler diagnostics. Do not mistake its hash for independent attestation.
7. Separately review real API buffer sizes, token group semantics, impersonation/unstable-token failures, close/cleanup behavior, x64 ABI and observation lifetime before any broader use. This one live read does not exercise negative Windows API errors or prove cleanup under failures. No automatic repeat, Execute unlock or G1 follows.

If execution policy or permissions block the script, keep BLOCKED without changing UAC, ExecutionPolicy, ACL, firewall, accounts or services. Effective privileges, protected project/DB/IPC access, network/loopback and same-user TOCTOU remain independent admission blockers even after a correct token observation.
