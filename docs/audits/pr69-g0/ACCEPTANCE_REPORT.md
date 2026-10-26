# PR69 successor: G0 readiness and reviewed contracts

Date: 2026-10-26. Base/control PR69 is a46510cb42a9dc98230042c1fd2aaaff3a39410d, tree 2d644caf337f43425f82e0943d37a66d112eb042. Source PRs65–69 are unchanged. Exact GitHub immutable commit/tree inventory: PR_INVENTORY.json. All four reviewed side PRs have exact PR64 merge base 9094a68fe723e6618e6726f97d8a7df67a76d790.

## Findings and integration

- P2, PR65: observer handle aliases pass the forced-watchdog model despite different PIDs. Added the reviewed five pure model tests alongside existing PR61 tests; independently observed RED, then GREEN with one uniqueness guard. This is a schema-proof gap, not evidence of surviving native processes or a general OS vulnerability.
- P2, PR66: exact receipt schema/closed-gate guards are already in PR69 and were NOT duplicated. New tests reproduce missing externally expected identity verification and mutable return-reference behavior. Integrated opt-in verifyBoundSyntheticReceipt and a detached frozen receipt projection. The helper returns authority NONE/execution DENIED and cannot authenticate the externally supplied expected record by itself.
- P2 test-contract issue, PR67: independently reproduced exactly eight failures in the actual disposable SQLite fixture on Node24: 23 PASS/8 FAIL/0 SKIP. All are phase2 actual Invalid queue state versus old expected Invalid queue directory. Inspection confirms outer directory validation vs inner transaction error sanitization. Test-only correction yields 31 PASS/0 FAIL/0 SKIP; ok=false, filesystem assertions, counts, conditional revalidation and integrity checks are preserved. queue.mjs is unchanged. Windows symlink portion is explicitly synthetic in the original fixture; hardlink and SQLite checks are actual temporary-file tests. No physical Q01 acceptance follows.
- PR68: retained historical QA conclusion and three non-authoritative BLOCKED-projection tests. The old artifact upload on failed PR64 is never treated as PASS. Historical findings are not current live OIDC evidence.

## G0 tooling and bounds

New collect-g0.ps1 reads only a separate existing LocalApplicationData/MathUniverseAdminitAcceptance descendant. No root creation or historical-tree inspection is attempted. It rejects path aliases/UNC/ADS/reparse ancestors, inventories ACL owner and suspicious write grants, observes non-admin role and Medium label via fixed System/whoami.exe arguments, and inventories enabled ActiveStore firewall rules matching active profile categories.

Raw identity, path, SID, utility stderr, ACL and rule details stay in memory. Output is normalized enums/booleans/counts only. Missing root, access failure, unreadable token or policy remains FAIL/UNKNOWN. ACL checks are conservative grant inventory, not effective access analysis. Profile-matching firewall rule counts do not prove application/address/port/loopback enforcement, IPsec policy or continuous isolation.

Node g0.mjs validates an exact bounded strict JSON contract, freshness, closed authority and network-unproven values. Perfect observations still return isolationConfirmed=false/localExecute=false/admission=BLOCKED. This code does not modify the existing isolation verifier, Execute guard, firewall, ACL, UAC, ExecutionPolicy or services. No PostgreSQL driver, port probe, socket connection, database command or service inspection is present.

G0 collector was NOT executed against this computer or ADMINIT. Only PowerShell5.1/7 Parser.ParseFile and synthetic JSON/static tests were executed. Same-user snapshots remain unattested. The previous collect-isolation.ps1 has a different private/raw output contract and must not be substituted into public evidence publishing.

## Acceptance matrix

|Scope|PASS|FAIL|SKIP|Meaning|
|---|---:|---:|---:|---|
|Local Node22.23.3 targeted suite|206|0|0|Receiver, pure watchdog/G0, parser-only, finite detached-journal fixture|
|Local Node24.20.0 same25 files|206|0|0|No full npm suite, production DB or physical fixture|
|Q01 old phase2 expectations RED|23|8|0|Confirmed reproducible test mismatch|
|Q01 corrected fixture GREEN|31|0|0|Temporary synthetic queue only|
|Windows PowerShell5.1 and pwsh parser-only|2|0|0|No collector invocation|
|Actual G0/ADMINIT isolation/native|NOT_RUN|—|—|BLOCKED pending independent approval|
|PR69 real OIDC run40309240276|QUEUED|—|—|Attempt1 job121525965401; no steps/artifacts yet|

Hashes for private RED/GREEN and final TAP: EVIDENCE_HASHES.json. No raw TAP/log bundle is published. git diff --check and tracked-document policy pass; tracked-document policy does not certify runtime logs or rewrite Git history.

## Hosted evidence and workflow scope

Current API inspection of run40309240276 still returns QUEUED, job steps empty, artifacts total_count0. Therefore real authorization, error stage, ZIP bytes/digest/inventory/privacy CANNOT be accepted yet. No stale or failure-only artifact substitutes for that evidence. No rerun or cancellation was requested.

This successor intentionally disables a new synthetic issuer request while the original PR69 qualification is unresolved. The caller pins collector snapshot53aff113b29746b8b393261a59889d344ac4b376 but its job is SKIPPED for this integration branch; SKIPPED is not qualification. Only the explicitly enumerated receiver/G0/finite queue contracts run on Linux/Windows Node22/24. Other native/full/PG/stress workflows remain excluded for this branch. On Linux the two Windows parser tests must be explicit SKIP, never fabricated PASS. Source PR workflows and settings are unchanged.

## Future operator-only G0 step (not execution authorization)

After independent source delivery and approval, use an already-existing separate acceptance checkout. Invoke the reviewed collect-g0.ps1 with its literal SourceCheckout, with ordinary non-elevated PowerShell5.1 and no ExecutionPolicy bypass. Pipe normalized JSON to reviewed node scripts/adminit-containment/g0.mjs. Both tools deliberately exit2 even for a complete snapshot, because admission remains BLOCKED. Do not redirect or upload raw output from the older collector. This document does not authorize running the command on ADMINIT now.

## Decision

GO only for independent review of the source and narrow hosted contract tests. G0 effective isolation NOT PROVEN; operational confidential acceptance BLOCKED awaiting real run/artifact and independent custody. Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED. No merge, physical/native execution, production operations or system changes.
