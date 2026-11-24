# PR73 token cleanup: independent implementation and fault coverage

Date: 2026-10-26. Before work GitHub confirmed control PR73 HEAD629edc7c328a31e4568fcccda51dc032e621ecab, tree4d7d44f4507039ca2f73363772aca750363430bd. Source PR73 remains unchanged.

## Confirmed findings

- P2: managed token byte arrays were cleared only on success. The exact original Git blob fails the new deterministic query-after-sid fixture in PS5.1 and7: native reads have created/populated arrays when a later query fails; nonzero tracked arrays survive Observe. This is retention/cleanup hygiene, not evidence of public exfiltration, token forgery or admission unlock.
- P2: CurrentStatistics could create an array and then throw from its handle-close finally before the caller received the array. Moving only local variable clears into Observe finally would still miss it. Every buffer is now registered at allocation, before copy/return. Failed registration clears the fresh buffer itself.
- P2 defense: exceptions from CloseHandle could previously become E_INTERNAL in helper paths. CloseOwned now maps false/throw to E_CLOSE consistently; cleanup failure cannot retain PASS. Allocation returning null is explicitly rejected before memory writes.
- No P0/P1 or admission bypass confirmed by this review. Existing impersonation, unstable identity, SID and closed admission policy remain.

## Fix

Observe owns a bounded list of all created managed token arrays. Its finally attempts every Array.Clear and the main token close independently. Cleanup failure overrides PASS with UNKNOWN; E_CLOSE has precedence over other managed-cleanup failure. Statistics, Integrity and CurrentStatistics register arrays before exposing sensitive data. QueryBuffer clears its pointer before disposal and frees memory in finally even when zeroing fails, preventing a repeated free attempt. The read-only TOKEN_QUERY requirement and API/public contracts are unchanged.

Guarantee is scoped to normal managed exception/control-flow paths in a running process. Termination/FailFast, corrupted runtime memory, hidden GC/JIT copies or a real cleanup operation that cannot complete are not proved secure-zeroization. A failed real CloseHandle may leave a resource alive: result is UNKNOWN and cleanup is not reported as successful.

## Deterministic test method

The test reads the actual production source, requires exactly six known DllImport declarations, removes them, rejects remaining DllImport/extern text, and redirects every native token call to a fake BEFORE compiling. Managed allocation tracking and copy/clear instrumentation expose actual arrays created by the production orchestration; fake API buffers use private synthetic HGlobal memory only. Observe then executes with no Windows Token API call, real token handle, account query, child native EXE or ADMINIT observation. The unmodified production C# also compiles separately; its real Observe path is NOT invoked.

34 deterministic scenarios per PS engine (one positive baseline and33 faults),68 scenario executions total per Node suite. Coverage includes primary/current OpenProcessToken failures, OpenThreadToken errors and early/late impersonation, GetTokenInformation size/fetch failures and inconsistent lengths, allocation throw/null/late failure, out-of-range integrity/group pointers, malformed/truncated SID/group tables, duplicate/conflicting admin groups, invalid elevation, changed identity, copy/free/clear exceptions, and false/throw from main/helper/thread close. Baseline requires exactly four tracked arrays; partial-read and helper-close cases require the expected created arrays, guarding against vacuous cleanup tests.

Fake CloseHandle removes modeled ownership before reporting failure; Free releases memory before throwing; Clear clears before throwing. These specifically test attempts, independent cleanup continuation and error precedence. They do NOT prove that a real failed close/free/clear physically completed. All retained tracked arrays are verified zero in the modeled paths.

## x64 ABI evidence and limits

Both Windows PowerShell5.1/.NET Framework and PowerShell7 compile the source. The instrumented runtime requires IntPtr.Size8, SID_AND_ATTRIBUTES size16 and Attributes offset8. Fabricated TOKEN_MANDATORY_LABEL, TOKEN_GROUPS and56-byte TOKEN_STATISTICS exercise correct and invalid pointer/table bounds. This establishes runtime struct geometry and parser behavior on synthetic buffers, not an actual GetTokenInformation ABI round-trip or32-bit support qualification.

## RED/GREEN matrix

|Check|RED|GREEN|
|---|---|---|
|Exact PR73 source, later query failure|Both PS profiles detect retained array|Both profiles zero all owned arrays|
|CurrentStatistics close failure|Covered by registered-array invariant|E_CLOSE/UNKNOWN, four arrays cleared|
|34 scenarios per engine|Original stops at reproduced defect|68 scenarios pass across PS5.1/7|
|Node22.23.3 targeted34 files|—|228 PASS/0 FAIL/0 SKIP|
|Node24.20.0 same scope|—|228 PASS/0 FAIL/0 SKIP|
|Real Windows Token API/ADMINIT/native G1|NOT_RUN|UNQUALIFIED|

SHA256 references: EVIDENCE_HASHES.json. Raw local TAP and compiler diagnostics remain outside Git. Independent static reviewer found no new P1/P2 in the revised ownership/finally/seam paths and explicitly noted the modeled cleanup-operation limitations above. Static review is not native runtime evidence.

## CI and acceptance

Only bounded receiver/G0 contracts are enabled for this branch; no full npm, Q01 stress, PostgreSQL, native G1 or additional issuer qualification. Skipped jobs are not PASS. Exact-head hosted result must be verified after the normal push; no rerun/cancellation or security/settings change is authorized by this report. git diff --check and tracked-document publication policy pass; they do not attest computer state or all runtime logs.

GO for independent review of the cleanup correction and modeled failure coverage only. Actual Token API cleanup, process isolation and physical admission remain unqualified. Admission BLOCKED, isolationConfirmed=false, localExecute=false. Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED.
