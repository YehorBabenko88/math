# Structured Windows Token G0 — design and acceptance

Date: 2026-10-26. Exact control PR72 base61f46d7b09642945637eaf797b0795b62fddc9b5, treed770579d234b529864b7da46d65c7c4efde03413 remains unchanged.

## Implementation

WindowsTokenObservation.cs contains a separate current-process, query-only adapter. It opens a process token with TOKEN_QUERY only, retrieves TokenIntegrityLevel, TokenElevation, TokenType, TokenGroups and private TokenStatistics. It refuses a thread impersonation context or failed/ambiguous API result. Integrity SID pointers must lie inside the bounded returned buffer before dereference; the mandatory label must have revision1, authority16, exactly one subauthority and integrity attributes. Medium RID8192, elevation0 and no enabled BUILTIN Administrators group are required for token-observation PASS.

Admin group parsing uses the SAME opened token handle as integrity/elevation. Every group table/SID header and subauthority span is bounded; exact binary Administrators SID is matched. Duplicate admin entries or enabled-plus-deny-only flags are UNKNOWN. TokenId/ModifiedId remain private and are compared before/after; current primary-token identity is rechecked. This detects some query-window drift but is not an atomic/continuous isolation guarantee.

Buffers are bounded at64KiB, cleared/freed and owned token handles closed. Query/format/close failures produce fixed UNKNOWN codes and null observations, never partial PASS. No privileges/token information are changed, no account/SID string resolution is performed, and no native EXE/process/service/database is started by the adapter. Same-user tampering and native runtime behavior remain outside compile-only evidence.

The PowerShell function g0-token-api.ps1 loads the reviewed source in a fresh process and refuses preloaded same-name types. No SDK installation or policy bypass is required; compile/load failure is E_LOAD/UNKNOWN. collect-g0.ps1 now calls only this structured function for token observation. CSV helpers remain legacy pure utilities/tests, NOT a live fallback. An unguarded duplicate legacy helper import was removed; required imports occur inside the collector's existing guarded try.

## Closed public contract

math.g0.token-api.v1 has exactly schema, scope, apiStatus, status, code, tokenType, integrityRid, elevated, adminEnabled, authority, isolationConfirmed, localExecute and admission. No SID, handle, process identity, path, native error text, raw API buffers or stack is exported. apiStatus OK requires complete typed fields, PRIMARY and a recomputed PASS/FAIL matching the three predicates. ERROR requires UNKNOWN, whitelisted code, UNKNOWN tokenType and all measurement fields null. Duplicate JSON keys, extra/private fields and contradictory results fail the Node CLI.

The RID is a public integrity-level number, not a SID/account identifier. adminEnabled means the enabled Administrators flag on the queried primary token, not absence of all powerful privileges or proof that the account is confined. authority NONE/isolationConfirmed false/localExecute false/admission BLOCKED are invariant. Both standalone producer and Node CLI exit2 even for a narrow token PASS; neither exit status nor PASS is physical admission.

## RED/GREEN and review

- Missing structured contract/policy implementation RED -> strict JSON and compiled pure policy GREEN.
- Collector still using CSV RED -> structured-only wiring GREEN.
- Independent static review found a possible mixed-token race in an initial NULL/effective-token admin query. That path was removed before publication. Same-handle TokenGroups parsing plus duplicate/conflicting admin flags has synthetic RED/GREEN coverage. Reviewer subsequently found no additional P1/P2 in that path; this was static analysis, not a reproduced native race.
- CLI absent/non-blocking exit RED -> bounded strict stdin, suppressed payload errors and invariant exit2 GREEN.
- Synthetic tests include Medium, High, Low, malformed/truncated SID, wrong SID authority/revision/count, missing integrity flag, invalid elevation/type, unstable identity, duplicate/conflicting admin entries, API-unavailable model, private fields and false PASS/unlock. API error models do not reproduce actual Windows API failures.

|Environment/scope|PASS|FAIL|SKIP|
|---|---:|---:|---:|
|Node22.23.3 targeted33 files|226|0|0|
|Node24.20.0 same scope|226|0|0|
|PowerShell5.1/7 C# compilation, wrapper/CLI parser and PURE policy calls|Included|0|0|
|WindowsTokenAdapter.Observe / live API / physical ADMINIT / G1|NOT_RUN|—|—|

The compile harness NEVER calls Observe or a P/Invoke. Only public pure TokenPolicy functions run with synthetic bytes; returned policy objects round-trip through both PowerShell serializers and the strict Node contract. Future API cleanup/fault handling, ABI and actual OS-token results are NOT qualified. RED/GREEN SHA256 references are in EVIDENCE_HASHES.json; raw local logs stay out of Git. git diff --check and tracked-document publication policy pass, without asserting full runtime privacy or rewriting history.

Narrow contract CI only is enabled for this branch. Native/full/PG/stress/issuer jobs are skipped, NOT accepted. On Linux the twelve Windows parser/helper/compile fixtures are explicit SKIP. No full npm test, Q01 stress, native G1, ADMINIT call, cancellation, policy change or production operation was performed.

## Sources and remaining limits

Primary API references:
- https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation
- https://learn.microsoft.com/en-us/windows/win32/api/winnt/ne-winnt-token_information_class
- https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-sid_and_attributes

Future limited read-only procedure: PHYSICAL_READONLY_PROCEDURE.md. It requires separate approval and independently accepted source delivery. No new token observation is represented as host attestation or effective filesystem/network/loopback isolation. Existing Windows/PostgreSQL/firewall/UAC/ExecutionPolicy/historical labs are unchanged.

Decision: GO only for independent code review of the prepared adapter and compile/model contracts. Live Token API qualification and all physical admission remain BLOCKED. Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED.
