# PR31 tracked-source preflight correction

Candidate audited: cb168925b5aeec0c957137dd94ab72c64f0bd333 (tree 10cfd29f5d2c75e841d88dd70bef8773dada8287).

## Confirmed defect (P2)

The read-only Windows laboratory preflight verified HEAD and equality of two current filesystem hashes. A stable modification to tracked source therefore still returned PREPARED. The initial mocked regression failed with `RED: unverified tracked source reported PREPARED`; a second reproduction recorded only `rev-parse HEAD` and `rev-parse --show-toplevel` Git reads. No laboratory workload or native containment ran.

The correction imports the existing tracked-tree verifier from the separately trusted auditor kit, never candidate JavaScript. It checks committed/index/worktree identity before and after the read-only filesystem snapshot. Both hashes must remain stable. NODE_OPTIONS/NODE_PATH are rejected before invoking Node, without changing them or printing their values. PATH resolution selects the first executable, as normal command resolution does; operator acceptance of the Node/Git executables remains mandatory.

The existing physical `-Execute` failure remains unchanged. Source authentication is not filesystem isolation and cannot defeat a malicious same-user process. No local file guard authenticates its own auditor kit. Prepare/verify the trusted kit separately before considering these diagnostics.

## Evidence

PowerShell 7 / installed Pester 3.4.0: 12 passed, 0 failed, 0 skipped. Original regression RED, corrected GREEN. Direct trusted-verifier read of the exact candidate succeeded with tracked source hash `07356bdaed7ce0cc89b42ae22149ac2aac4fed621fc06f701abfee94c5e02691`.

PowerShell 5.1 Pester was BLOCKED by existing execution policy. No policy or security setting was changed. Hosted PowerShell 5.1 is a separate required check, not implied by the local result.

## Future ADMIN PC diagnostics (documentation only; NOT authorized/executed)

These commands are read-only and do not install tools, invoke the laboratory runner, create a job, start services or touch a queue. Use a non-elevated session. Do not weaken execution policy if blocked. Pin a separately accepted kit and source first; paths below are placeholders, not authority.

```powershell
whoami
$PSVersionTable.PSVersion
Get-ExecutionPolicy -List
Get-Command node.exe,git.exe,powershell.exe,pwsh.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object Name,Source
[pscustomobject]@{NodeOptionsPresent=[bool]$env:NODE_OPTIONS;NodePathPresent=[bool]$env:NODE_PATH}
# Substitute the accepted literal source path only after independent review:
$Candidate = 'C:\PATH\TO\ACCEPTED\SOURCE'
& git --no-optional-locks --no-replace-objects -C $Candidate rev-parse HEAD
& git --no-optional-locks --no-replace-objects -C $Candidate rev-parse 'HEAD^{tree}'
& git --no-optional-locks --no-replace-objects -C $Candidate status --porcelain=v1 --untracked-files=no
```

Expected HEAD/tree are above. A clean status alone does not prove byte equality under EOL filters; the trusted-kit byte verifier is additionally required. Do not run candidate scripts, `-Execute`, physical G1, Node preloaders or native harness on ADMIN PC under this document. Fixed lab root, non-elevation, reparse/hardlink rejection, external watchdog and independently accepted Job Object ownership remain prerequisites. Job Objects do not provide filesystem or network sandboxing. Untracked trees and resource/deadline limits of read-only scans remain operational limitations. PHYSICAL G1 BLOCKED, Q01 OPEN, production NO-GO.
