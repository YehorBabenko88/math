# Independent PR70 physical G0 evidence review

Date: 2026-10-26. Control PR70 HEAD 3dc9ddc3e382aa18aadfcf8fe6d51ffa5b3ea9af, tree299e75cfae61e91150fa330efe1a53bb4ea6c179, unchanged.

## Physical evidence actually available

Public handoff: https://github.com/YehorBabenko88/math/pull/70#issuecomment-6414630207

It reports operator execution on ADMINIT: exact source/clean tracked tree, Medium guard, 32 pure/model tests PASS, PowerShell5.1 parser zero errors, actual collector checks PASS and exit2, evaluator OBSERVATIONS_COMPLETE/admission BLOCKED/exit2. Reported terminal evidence is UTF16LE,5140 bytes, SHA256658d4a91613a960f11a3c0f7d23bfb138b05aa1b44ef9da675945403e5c5d8a1; reported evaluator snapshot digest211ee99ed1686fb4d3c9974b2ad12b85ba5cd413ba13d752289f68e0362b7c4c.

Original private terminal/snapshot bytes were NOT supplied to this review. These are reported hashes, not independently rehashed files or computer attestation. The quoted observed active profile/rule counts do not establish effective isolation. No conclusion that the actual ADMINIT token or ACL was malicious or misclassified follows from our synthetic counterexamples. Historical physical evidence is not rewritten or discarded.

## Confirmed defects and RED/GREEN

|Finding|Scope and reproduction|Correction|Authority impact|
|---|---|---|---|
|P2 G01|firewall=PASS with null counters or zero active profiles still returned OBSERVATIONS_COMPLETE|Reject contradictory/incomplete PASS inventory|No Execute fail-open existed; misleading observation-quality classification|
|P2 G02|Whole-text token regex accepts a Medium SID appearing only in a CSV display-name column with no integrity-label SID column|Parse strict four-column CSV; classify only exact SID field; reject malformed/ambiguous labels and enabled admin role|Narrow parsing robustness defect; no claim of authentic token forgery or observed physical misclassification|
|P2 G03|ACL inventory covered root/checkout but skipped intermediate parent directories|Inspect every component inside the bounded root-to-checkout chain|Does not calculate effective rights, source-file trust or same-user isolation|
|P3 G04|Invalid date2026-02-30 could roll into a fresh March2 snapshot|Require calendar/time round-trip before freshness check|Admission still BLOCKED before and after|

The G0 invariants authority NONE, isolationConfirmed false, localExecute false, admission BLOCKED and exit2 remain. No positive admission path or change to Execute guard was introduced. Helper import is inside the collector's guarded try; errors remain normalized.

## Tests and negative cases

- Evaluator RED: inconsistent inventory and invalid calendar cases fail the old implementation. GREEN after minimal checks.
- Pure PowerShell fixtures reproduce the old regex false classification using fixed synthetic text and test Medium/high/low/admin/malformed/ambiguous cases. No whoami invocation, ACL query, firewall query, process/native fixture or ADMINIT access occurs in these fixtures.
- Pure path fixture confirms intermediate components and rejects scope escape, without inspecting those paths.
- Stale/future observation, ACL/firewall/token FAIL, raw/extra source identity and authority extensions stay rejected/incomplete/BLOCKED.
- Same-count firewall replacement and source replacement cannot be detected by v1 public snapshots; tests assert that they never confer attestation or execution. These are explicit coverage limits, NOT claimed change detection.

|Environment|PASS|FAIL|SKIP|
|---|---:|---:|---:|
|Local Node22.23.3, targeted26 files|213|0|0|
|Local Node24.20.0, same scope|213|0|0|
|PowerShell5.1/7 parser-only and pure helper fixtures|Included above|0|0|
|ADMINIT collector/native/G1 execution by this review|NOT_RUN|—|—|
|Effective filesystem/network/loopback isolation|UNPROVEN|—|—|

RED/GREEN hashes: EVIDENCE_HASHES.json; raw local logs stay out of Git. Existing finite detached-journal tests were included, not stress/full npm/production DB tests. On Linux four Windows parser/pure-fixture tests are explicitly SKIP, not PASS. git diff --check and current tracked-document publication policy pass. Neither proves runtime-log privacy or clears history.

## Admission and continuity

PHYSICAL_ADMISSION_CONTRACT.md defines read-only prerequisites, protected scope, source/token/policy binding, administrative-account limits and the distinction between detection and continuous enforcement. It is a design, NOT an implemented launch/controller mechanism. Existing enforcement configuration has not been independently evidenced; no setting is changed or assumed.

The corrected collector may be inspected in a future approved read-only run. It cannot verify itself against hostile same-user replacement and cannot retroactively attest earlier observations. It has no PostgreSQL driver/socket/port probe/service commands. No historical lab or protected production state was touched.

## Hosted bounds

At this review, original issuer run40309240276 attempt1 job121525965401 is still QUEUED with zero steps and artifacts. Authorization/ZIP/digest/privacy remain unverified. No rerun/cancellation; successor workflow disables another issuer request and allows only narrow contract CI. A failure artifact or a skipped workflow is not PASS.

## Decision

GO for independent code review of confirmed corrections and the draft contract only. Physical admission is BLOCKED: trusted source/observer provenance, effective file/service/IPv4+IPv6 loopback/network isolation, restricted token/privileges, same-user custody and continuous enforcement all remain unproven. Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED.
