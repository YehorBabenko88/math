# G0 diagnostic OS-attribution integration

## Exact inputs and decision

Base: PR80 `85539b8b761226530b55ec67460dfc4a898b85a8`. Independent fix: PR81 `71250be0bdc0839083d6540550cd70f3cb355758`, whose exact base is PR80. Both GitHub HEADs were checked before work. This successor imports the single validator condition removal and all three PR81 regression tests, then adds an exhaustive independent truth table. No merge, rewrite or modification of either source PR occurred. Candidate HEAD/tree are independently reported in the successor Draft PR.

P2 CONFIRMED: E_INTERNAL/OS/OS was accepted although the adapter emits E_OS/OS/OS for the unsupported-OS branch and never emits E_INTERNAL at that site. This was false diagnostic attribution, not admission or an observed privilege escalation: the original accepted object still had ERROR/UNKNOWN and closed gates. The minimal fix removes OS/OS from the E_INTERNAL allowlist, matching PR81 exactly. C# adapter, PowerShell producer, composite collector, CLI behavior, AdminState and cleanup remain unchanged.

RED: imported PR81 tests before the fix — 7 PASS, 1 FAIL (the OS-attribution regression). GREEN after one-line fix — 8 PASS. Exhaustive coverage added afterward — 9 PASS in the token-contract file.

## Complete combination check

The independent specification enumerates exact allowed triples rather than importing validator internals. All 17 stage enum values and 13 category enum values are crossed with nine permitted error codes and two invalid code controls (NONE and an unrecognized code).

| Matrix | Accepted | Rejected | Total |
|---|---:|---:|---:|
| ERROR code × stage × category | 92 | 2339 | 2431 |
| OK PASS/FAIL × stage × category | 2 | 440 | 442 |

Accepted errors remain UNKNOWN and retain their original code. UNKNOWN/UNKNOWN remains an explicitly unattributed pure-factory result; it does not assert that an API site was observed. E_OS/OS/OS is accepted; E_INTERNAL/OS/OS is rejected. Each historical v1 error code is checked without diagnostics; mixed v1/v2 fields remain rejected. Original v2 private-field, wrong-type, CLI fixed-error/exit2 and false-PASS tests remain.

The entire original fake-native suite is byte-unchanged: 137 scenarios per PowerShell5.1/7, 274 per Node invocation, including combined cleanup failures and exact diagnostic expectations. All results are round-tripped through the tightened Node validator. No real Token API was invoked.

## Executed local tests

Bounded inherited 36-file receiver/G0 suite, without name/skip filters:

| Runtime | PASS | FAIL | SKIP |
|---|---:|---:|---:|
| Node22.23.3 | 240 | 0 | 0 |
| Node24.20.0 | 240 | 0 | 0 |

PowerShell5.1/7 compile/pure/fake scenarios execute inside that suite. Separately, tests/ci-coverage.test.mjs was run as a safe contract test (synthetic child fixtures and validation only, no PostgreSQL connection): 3 PASS / 1 FAIL, reproducing the inherited literal-assertion issue below. This additional FAIL is not included in or hidden by the bounded-suite PASS counts. No full npm suite, PostgreSQL, Q01 stress, native G1 or physical call was executed. git diff --check PASS.

## Independent PR81 failure investigation

Read-only GitHub API inventory and private job logs were examined for exact PR81 HEAD. No workflow was rerun/cancelled, no artifact executed, and no credentials/settings changed. Safe fixed classifications and SHA256 for all 14 investigated failed test jobs are in PR81_FAILURE_RECEIPTS.json. The two matrix coverage aggregators are downstream failures, not independent root causes.

| Workflow runs (attempt1) | Evidence and conclusion |
|---|---|
| Validate 40495271719 push; 40495279314 PR | ci-coverage.test.mjs requires the literal regex `if: always()`; inherited PostgreSQL workflow uses a composite expression containing `(always())` plus the scoped-branch guard. The contract assertion fails. Reproduced locally. |
| PostgreSQL 40495271754 push; 40495279087 PR | All eight matrix-cell logs have the same single failed ci-coverage assertion. Both Full CI coverage aggregators correctly reject failed cells. No PostgreSQL runtime defect is established by these logs. |
| Windows Deployment 40495278970 PR | Both shell-profile logs contain HTTP404 from Invoke-WebRequest against the approved Pester endpoint. PowerShell fails during the integrity fixture download; pwsh passes fixture composition checks, then a subsequent installer verification download returns404. The HTTP failure is observed; its upstream cause/permanence is unproven. No alternative unapproved artifact or digest bypass was added. |
| Q01 Queue Reliability 40495271798 push | Windows lab guard failed preparing the approved Pester framework: download HTTP404. Other Q01 run 40495279018 PR succeeded; neither historical run qualifies Q01 closed. No stress job was rerun here. |
| ADMINIT Synthetic Harness 40495279157 PR | Native job records opaque exit2 and fails before independent native verification. Public output intentionally withholds raw bootstrap diagnostics. The actual internal native failure cannot be established from this evidence; native acceptance remains BLOCKED. No native retry or execution occurred in this investigation. |

The CI assertion and Pester installer/test code are unchanged, including their assertions and digest requirements. This narrow diagnostic fix does not resolve or waive those broader failures. In particular, scoped receiver/G0 CI success cannot be reported as full repository/Windows deployment/native success.

## Scoped CI and evidence

The inherited no-native/no-PG/no-Q01-stress qualification profile is retargeted only to the new successor branch. This carries forward the base's explicit safety scope; it does not change repository required checks or global settings. Unrelated jobs are NOT_RUN/SKIPPED for this branch, never qualification PASS. Full-suite test assertions, aggregator result requirements, Pester digest checks and native guards are not weakened. Their observed prior failures remain open in this report.

Allowed exact-head CI: receiver/G0 contracts on Windows/Linux Node22/24, unchanged 36-file inventory. Expected Windows: 240 PASS / 0 FAIL / 0 SKIP; Linux: 224 PASS / 0 FAIL / 16 Windows-only SKIP. Exact-head job outcomes, run/attempt and log hashes must be checked after push; base or PR81 SUCCESS cannot substitute. No raw evidence upload is configured. Public hashes identify local private transcripts without republishing them.

## Findings, readiness and limits

- P2 diagnostic attribution defect: reproduced and corrected with the exact minimal PR81 fix; exhaustive and original scenario tests are GREEN.
- P2 inherited CI-contract mismatch: reproduced, left unchanged; full-integration acceptance is not granted.
- Pester download HTTP404: confirmed operational failure in the inspected jobs; upstream cause unresolved, integrity policy retained.
- Native opaque exit2: confirmed failed/blocked job; internal cause and native qualification unresolved because evidence is unavailable at that boundary.
- No new P0/P1 demonstrated in this bounded fix. Static review and synthetic tests do not exclude undiscovered defects.

Ready only for independent review of the diagnostic fix, subject to actual scoped exact-head CI evidence. No physical readiness/admission is granted. Actual Windows API behavior, physical E_QUERY attribution, native cleanup success, host/source independence, effective isolation and continuous enforcement remain unqualified.

Invariants: authority=NONE; isolationConfirmed=false; localExecute=false; admission=BLOCKED. Q01 OPEN; Physical G1 BLOCKED; Production NO-GO; Book gate CLOSED. No ADMINIT Token API retry, Windows settings change, PostgreSQL production operation, laboratory change, deployment or merge.
