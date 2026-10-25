# ADMINIT read-only criteria and next safe observation

The user describes the entire ADMINIT PC as a test environment. Preserve that scope fact separately from measured protection. Historical MathUniverseLab and the existing PostgreSQL18 remain protected and are never inspected, connected to or altered by this collector. No local collector invocation was performed by Codex.

User-reported facts: PowerShell5.1 build26100.9711, Node24.20.0, Git2.55.0.windows.5, MediumRID8192, Administrators deny-only, CurrentUser RemoteSigned, Add-Type available. Earlier policy was Restricted. Cause/actor/time of that change UNKNOWN. No attribution or remediation is inferred, and no policy is changed.

Collector `scripts/adminit-containment/collect-isolation.ps1` produces stdout JSON only: current machine/user SID, managed token group observations, OS policy values, new-root owner/write-rule snapshot and nonloopback interface-up count. It executes no subprocess, issues no file-write commands and queries no service or endpoint. OS/runtime auditing or cache effects are not assessed; this is not a byte-level filesystem isolation claim. It rejects a checkout outside the new root and existing reparse ancestors before descendant inspection. Source identity is deliberately null/UNKNOWN: initial Git-based collection was removed after an independent safe repro showed GIT_TRACE can write during rev-parse, and Git context/metadata can redirect outside the root. Evidence retained in the integration audit.

Evaluator `isolation.mjs` accepts bounded JSON text, rejects extra authority/environment claims, checks external expected source identity/freshness and reports individual observation status. **It always returns isolationConfirmed:false, admission:BLOCKED, localExecute:false and exit2.** A complete-looking snapshot, signature without a qualified collector, policy string or environment flag cannot grant authority.

Objective criteria and present gaps:

| Criterion | Read-only observation | What it does not prove |
|---|---|---|
| Machine/session | actual OS identity, PS version, managed roles/group SID snapshot | deny-only numeric attributes require qualified token measurement; user text is not it |
| Source/package | separate approved delivery and immutable file verification required | collector intentionally does not invoke Git or authenticate its own kit |
| Laboratory | new-root ownership/ACE/reparse snapshot | continuous exclusion of same-user writers or protection of parent namespace |
| External links | complete managed NIC inventory / active nonloopback count | process-specific denial, loopback/local PG denial, future link state |
| Resource boundaries | independent existing mechanism/provisioning evidence required | whole-PC test purpose alone does not prove absence of outside production reachability or local-service access |
| Execution authority | independent exact-head/native acceptance + explicit local synthetic admission | no automatic Execute/G1/production status from observations |

The next concrete safe ADMINIT step, only after separate permission for read-only observation, is to record current `$PSVersionTable.PSVersion`, `Get-ExecutionPolicy -List`, `[Environment]::MachineName` and `[Security.Principal.WindowsIdentity]::GetCurrent().User.Value` in the existing non-elevated session. These do not invoke the new native harness or touch the historical laboratory/PostgreSQL. Do not alter policy, unblock files, install tools or change rights to make a later script run.

The new collector may be staged only after independent kit delivery/permission into the separate future root described in adminit-future-checkout-plan.json. No staging, clone or directory creation has occurred on ADMINIT. Its evaluator output is diagnostic BLOCKED, not an admission receipt. Next Q01 design remains disabled.
