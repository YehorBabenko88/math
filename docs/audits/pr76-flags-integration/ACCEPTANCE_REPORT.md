# G0 TokenGroups flags + cleanup integration audit

Date: 2026-10-26. Exact control PR76 HEAD5ec1ead35570e5fff9293d6a982dfe19a1057b00, tree8a1c676a1f9477a227d973bb9c251a23c700ee62 was verified before branching. Its hosted run40400504889 is completed SUCCESS; four Linux/Windows Node22/24 jobs and their scoped contract steps are SUCCESS. PR75 exact reviewed HEADdb35a2f7fb3bf55e3337d2d86d57b6f6d8790ad1 is based on PR73, not the cleanup successor.

## Integration and findings

P1 supplied/reproduced policy finding: AdminState(1,0x80) returned0 (non-admin) under the exact PR76 source, allowing a malformed Administrators entry to contribute to a synthetic token PASS. The new compiled PS5.1/7 test checks0x80 FIRST and fails against the exact control Git blob (RED). Only PR75's one-line AdminState allowed-mask correction and its reviewed tests were transferred. The same test is GREEN in the integration source. No claim that Windows emitted this malformed group or that a real privilege escalation occurred.

The production C# diff is exactly the AdminState mask line. WindowsTokenAdapter and all cleanup ownership/Observe/finally helpers are unchanged from PR76 after Git-EOL normalization. CLEANUP_PRESERVATION.json contains their identical canonical class hash; old Observe was not imported from PR75. Source PR73/75/76 and main remain unchanged. No git merge/rebase/squash or source-branch update was performed.

No new P0/P1/P2 finding in independent static review. The prior P2 cleanup remains regression-tested. Native adapter behavior, failure cleanup and physical isolation remain unqualified.

## Flags semantics

The admin-specific0x1F mask permits MANDATORY/ENABLED_BY_DEFAULT/ENABLED/OWNER/USE_FOR_DENY_ONLY metadata only for the matched Administrators SID. Enabled+deny-only is contradictory and returns-1. Unknown/reserved bits, INTEGRITY/INTEGRITY_ENABLED, RESOURCE, partial LOGON_ID and full LOGON_ID on that Administrators SID return-1, propagated as E_FORMAT/UNKNOWN. This is not a blanket rejection of those flags elsewhere in TOKEN_GROUPS: a separate valid non-admin logon SID with full logon attributes remains accepted.

An absent Administrators group (0 matches,0 attrs) is non-admin; a nonzero attrs record with0 matches or duplicate matches is invalid. A null SID pointer in an existing group entry is E_FORMAT, never equivalent to an absent admin group. Enabled admin becomes token FAIL. Medium8192/non-elevated with valid deny-only admin metadata (including permitted mandatory/owner/default metadata without ENABLED) remains eligible for token-observation PASS, while authority NONE/isolationConfirmed false/localExecute false/admission BLOCKED remain invariant. The actual ADMINIT token was NOT queried; this is semantic/model coverage, not physical confirmation.

Primary flag definitions: https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-token_groups

## RED/GREEN and tests

|Check|Result|
|---|---|
|Exact PR76 compiled AdminState(1,0x80)|RED in PS5.1 and7|
|Same check with PR75 mask|GREEN in both|
|Enabled/disabled/deny-only metadata, unknown/logon/resource/integrity flags, zero/duplicate counts|Compiled pure tests PASS|
|All original34 fault scenarios|Retained unchanged by name; PASS both engines|
|Additional admin reserved/logon/null/absent/enabled and non-admin logon cases|Six new scenarios PASS|
|Total synthetic orchestration scenarios|40 per engine,80 per Node suite|
|E_CLOSE/E_CHANGED/E_IMPERSONATION/E_FORMAT|Explicit code assertions PASS|
|Node22.23.3 targeted36 files|233 PASS/0 FAIL/0 SKIP|
|Node24.20.0 same scope|233 PASS/0 FAIL/0 SKIP|
|Original production C# compile + PS5.1/7 parser/pure tests|PASS; real Observe NOT_RUN|
|Physical ADMINIT / native G1 / live Token API|NOT_RUN / UNQUALIFIED|

Fault tests remove all native declarations before compiling instrumented production orchestration. Private synthetic HGlobal buffers and fake handles are used; no Windows Token API or ADMINIT token is queried. x64 layout/pointer guards and managed-array zeroing remain covered. Failure-returning fake cleanup operations model attempts/error precedence, not proof of successful real OS release. The uninstrumented class is compile-tested separately, not invoked.

EVIDENCE_HASHES.json references private local RED/GREEN/final TAP. The older arithmetic witness from PR75 is explicitly not native execution; the new compiled and fake-adapter tests provide the meaningful integration evidence. No full npm, Q01 stress, production DB, Windows policy or historical-lab operation. git diff --check and current tracked-document policy pass. No raw logs/handles/SIDs are uploaded.

## Hosted qualification and readiness

Only bounded receiver/G0 contracts are enabled for this branch. Extra issuer/native/full/PG/stress jobs are intentionally skipped and are not qualification PASS. On Linux sixteen Windows-only parser/compile/fake tests are expected explicit SKIP (217 PASS/16 SKIP if the same233-test inventory runs); Windows must execute all233 tests. Exact-head run/job/attempt and actual step results must be inspected after publication; no stale base-CI result qualifies the successor and no blind rerun/cancellation is requested.

GO for independent code review only after exact-head hosted contract evidence. No synthetic PASS grants physical qualification. Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED. authority NONE, isolationConfirmed false, localExecute false, admission BLOCKED remain unchanged.
