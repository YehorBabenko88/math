# PR82 G0 v2 — independent physical observation admission dossier

**Status: DESIGN / NOT_AUTHORIZED.** This document does not authorize a Token API call or any native execution. Control source: PR82 HEAD `26e4651bf39312b7e2169dab0e4d72f717d53aee`, tree `ddce920f465dde2ec2eb9a06fbaa45ff50c999b7`. PR80/81/82 and historical source checkouts must remain unchanged. Review this document against the exact new branch HEAD before using it; never use a floating branch for physical observation.

## Historical evidence and the unresolved question

One prior operator-authorized read on ADMINIT from exact PR78 produced `math.g0.token-api.v1` with `apiStatus=ERROR`, `status=UNKNOWN`, `code=E_QUERY`, `producerExit=2`, `validatorExit=2`, `authority=NONE`, `admission=BLOCKED`, `localExecute=false`, `isolationConfirmed=false`. That read's authorization is consumed. Neither the raw bytes nor an independently trusted source/observer attestation have been supplied. Its exact failing API/stage is unknowable from v1; do not retroactively invent Q/T labels.

PR82 uses `math.g0.token-api.v2`, with closed diagnostic stage/category values. This can narrow a **future** error site but cannot prove the cause of the prior PR78 failure, absence of impersonation over time, effective token custody, isolation, or reliable OS cleanup from one observation.

## Gate A — source and execution boundary (offline only)

- An independent reviewer confirms **exact HEAD and Git tree**, expected file blob hashes for `WindowsTokenObservation.cs`, `g0-token-api.ps1`, `observe-token-api.ps1`, `token-contract.mjs`, and any transitive imports. Cross-check hashes against GitHub immutable blobs, not only values produced on the same host.
- Place source in a **new, separate** directory under `%LOCALAPPDATA%\MathUniverseAdminitAcceptance`; use a detached exact SHA checkout, no local edits, no untracked files, no reparse ancestors, and no reused build output. Refuse if root/source identity drifts.
- Read-only parser/compile-only checks must run before any native query. They do not qualify real ABI. Do **not** load unreviewed binaries or run a previously compiled DLL.
- Independently inspect v2 producer-to-validator binding, strict field allowlist, fixed CLI exit 2 and nonprinting blocked diagnostics. The composite collector remains v1-minimal and **must not** re-export diagnostic stages.
- Verify the target is the intended physical Windows machine, OS architecture, PowerShell5.1 executable provenance, and a fresh `-NoProfile -NonInteractive` **non-elevated Medium** session. No enabled Administrators role, no preloaded adapter types. A caller-session check alone is not an attestation of the new child process.
- Refuse on source/wrapper/tool identity uncertainty, unexpected script/policy requirement, or any request to relax UAC/ExecutionPolicy/ACL/firewall. Static reads may be completed without activating the Token API.

## Gate B — separate operator approval (not supplied)

A new, explicit, scoped operator authorization is required **after** Gate A and independent source/security review. The operator must approve **one new process / one read-only token observation** against the accepted immutable HEAD. Approval must not be inferred from prior PR78 permission or generic “continue” instructions. No loop, auto-retry, fallback to `whoami`, elevated shell, native G1, Job Object stress, Q01 exercise, database/service query, network isolation probe, or deployment is included.

If consent is not explicit and current, **stop at Gate A**. Do not run `observe-token-api.ps1` or `collect-g0.ps1` for physical qualification.

## Gate C — bounded observation and privacy (only after Gate B)

- Launch exactly one **new** PowerShell5.1 `-NoProfile -NonInteractive` producer process, with the exact vetted `observe-token-api.ps1`. Capture exit status immediately before any other child process. Require exactly one bounded JSON record; do not echo/store raw stdout, stderr, paths, handles or native error codes in public chat.
- Preserve the producer's output **only in approved private custody** long enough to pass the exact-head `token-contract.mjs` validator. Capture validator exit independently (2 expected). A malformed record, unexpected exit, multi-line output or stderr means **BLOCKED, no retry**.
- Share publicly only the normalized allowlisted `apiStatus`, `status`, `code`, `diagnosticStage`, `diagnosticCategory`, optional `tokenType`/RID/elevation/admin booleans, `authority`, `localExecute`, `isolationConfirmed`, `admission`, and both exit statuses. Public reporting of diagnostic stage alone must not be described as independent host attestation.
- v1 must have **no** v2 diagnostic fields; v2 must have **both**. No synthetic or copied fields may substitute for the producer bytes. Reject extra keys, raw SID/token buffer, PID, handle, path or raw Win32 error data.
- A token `PASS` only describes one observation in that child process. A later error or cleanup failure must yield `UNKNOWN`; CloseHandle failure retains `E_CLOSE` precedence. Admission is always BLOCKED and `localExecute=false`.

## Acceptance matrix

| Check | Required evidence | Current result |
| --- | --- | --- |
| Exact PR82 source/tree | GitHub immutable SHA/tree + host comparison | GitHub confirmed; new physical checkout NOT_RUN |
| Hosted scoped contracts | Exact-head run/jobs/attempt, Windows Node22/24 & Linux Node22/24 | PR82 run 40498291308 4/4 SUCCESS |
| Historical v1 compatibility | Strict separate schema tests | Synthetic PASS, not host v2 |
| v2 diagnostic attribution | Q1–Q7/T1–T3 + error/category negative matrix | Synthetic PASS, native NOT_RUN |
| Windows native ABI/close/cleanup | Live bounded read and independent review | UNQUALIFIED |
| Effective filesystem/network/IPv4+IPv6 loopback, PostgreSQL/IPC | Independent enforcement/custody and continuity evidence | UNPROVEN |
| Independent source and observer custody / same-user TOCTOU | Trusted evidence beyond same-account hashes | UNPROVEN |
| New single-call authorization | Separate explicit operator approval | NOT_AUTHORIZED |
| Execute/G1/production | Independent physical admission not implied by G0 | BLOCKED / NO-GO |

## Stopping and escalation

Any FAILED/UNKNOWN provenance, API error, diagnostic mismatch or time-of-check/time-of-use uncertainty stops the investigation. Record normalized observations without raw identifiers; report the unresolved stage/category and ask for independent source review instead of silently expanding authority. No rerun or system configuration change. A successful scoped hosted workflow, compiler PASS, local SHA256, diagnostic stage or token PASS does **not** admit G1.

**Q01 OPEN · Physical G1 BLOCKED · Production NO-GO · Book gate CLOSED.**
