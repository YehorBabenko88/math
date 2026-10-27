# G0 E_QUERY investigation — no physical retry

## Decision

Synthetic contract coverage PASS; physical cause UNRESOLVED. This change adds tests and scopes CI; it does not change production Token API behavior. It is not a fix for the reported physical failure. No physical retry is authorized. Q01 OPEN; Physical G1 BLOCKED; Production NO-GO; Book gate CLOSED. authority=NONE, isolationConfirmed=false, localExecute=false, admission=BLOCKED remain mandatory.

Exact base: PR78 `32f86e24ea33b105f647ac3841f24e3266691bc5`, tree `1efe6881f43393d66ef57c380f7c8243fd0c866c`. Candidate identity is the Draft PR head; this document does not recursively assert its own containing commit. The production C# file is byte-identical to the base Git blob, preserving P1 flags and P2 cleanup.

## Findings

- P1 operational blocker: the single authorized physical observation reported E_QUERY/UNKNOWN and exit 2. That code merges multiple failure sites, so it cannot establish the failing API or root cause. No additional physical observation was made. No confirmed production defect has been reproduced.
- P2 test coverage gap: the prior fixture covered only selected query failures, not every query ordinal, malformed probe, changed response length, and thread-check ordinal. This PR adds deterministic targeted coverage and verifies injection was reached, rejection occurred at that exact ordinal, and resources/managed arrays were cleaned up.
- P0: none demonstrated within this bounded investigation. This is not evidence that no P0 exists elsewhere.

## Complete E_QUERY map

`QueryBuffer` rejects (1) successful null/zero size probe, (2) probe failure other than insufficient buffer, (3) zero requested length, (4) requested length above 65536, (5) zero allocation pointer, (6) failed data read, (7) actual returned length different from allocation size. All are UNKNOWN, never PASS. Allocation exceptions are E_INTERNAL, not E_QUERY; malformed successfully returned structures are E_FORMAT.

`NoImpersonation` rejects successful OpenThreadToken with zero/invalid handle, and any failed OpenThreadToken other than no-token. A valid returned thread token is closed and classified E_IMPERSONATION; failed close takes E_CLOSE priority. No-token must be an explicit failed call with the documented no-token error. A missing/zero error is not evidence of absence.

Query ordinals: Q1 initial statistics; Q2 integrity; Q3 elevation; Q4 token type; Q5 groups; Q6 final statistics; Q7 current-primary statistics. Thread-check ordinals: T1 before opening, T2 before final statistics, T3 after current-primary statistics.

## Interop review

The declarations match Windows BOOL, HANDLE/pointers, 32-bit enum/DWORD, out DWORD length, and BOOL OpenAsSelf. Both relevant declarations use SetLastError=true and explicit BOOL marshaling. GetLastWin32Error is consumed only on failed probe/thread-open paths and before another native call. Successful data reads do not consult stale last-error. OpenThreadToken uses query-only access and process context for access checks; this does not turn an impersonating thread into a primary-token observation.

A successful zero-length probe is rejected, not silently accepted. A failed read reporting insufficient buffer or any other error remains UNKNOWN. Response growth/shrink remains UNKNOWN rather than retrying a potentially changed token. Exact response-size policy may reject unexpected real OS behavior; no physical evidence currently proves that occurred. No fallback to CSV, no token mutation, and no permissive retry was introduced.

References: [GetTokenInformation](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation), [OpenThreadToken](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openthreadtoken). Documentation supports contract review, not attribution of the observed host failure.

## RED / GREEN evidence

Coverage RED: test calls added before fake-native implementations failed in both PowerShell engines. This is a missing-test-harness capability, not a reproduced production bug.

Mutation RED: three isolated source copies deliberately accepted a successful probe, ignored changed result length, or accepted failed thread-open with an unexpected error. Each mutation was rejected by both synthetic PowerShell tests. Mutants were never committed or executed against native APIs. Unmodified production orchestration is GREEN.

Per PowerShell engine: 40 preserved baseline scenarios (including all original 34 cleanup scenarios), 77 targeted query cases (7 ordinals × 11 modes), 18 thread cases (3 ordinals × 6 modes): 135 total. Across PowerShell 5.1 and 7: 270 cases per Node run. Cases include probe error with zero last-error, anonymous-thread rejection, no-token success path, stale last-error after successful reads, and exact E_QUERY checks. Existing E_CLOSE, E_CHANGED, E_IMPERSONATION, E_FORMAT assertions remain unchanged.

All six production native declarations are removed before synthetic compilation and replaced with the fake seam. No real Token API is called. ABI/layout compilation and synthetic memory operations are not live Windows API qualification.

Local bounded 36-file suite: Node22.23.3 233 PASS / 0 FAIL / 0 SKIP; Node24.20.0 233 PASS / 0 FAIL / 0 SKIP. Includes PowerShell5.1/7 compile/pure/fake tests. No full npm suite, physical native execution, PostgreSQL or Q01 stress. An existing bounded temporary SQLite detached-journal fixture remains in the inherited scope. git diff --check PASS.

CI scope is retargeted to this isolated branch: four receiver/G0 Windows/Linux Node22/24 jobs; unrelated native, issuer, full, PostgreSQL and stress jobs are excluded. These exclusions are not acceptance PASS. Linux is expected to report 217 PASS / 16 Windows-specific SKIP; Windows 233 PASS / 0 SKIP. Actual exact-head hosted outcomes must be checked independently after push; no stale base SUCCESS qualifies this successor.

## Diagnostics and next admission

No new public stage field or raw error logging was added. Fixed closed diagnostic stage identifiers could distinguish Q1–Q7/T1–T3 and probe/read/allocation categories in a future reviewed private observation, but no collection or physical retry is authorized here. Do not infer a host stage from synthetic cases. Never publish raw Win32 errors, token data, identity, handles, paths or stack traces as physical evidence.

Next step: independently review this coverage and exact-head hosted results, then separately approve a privacy-bounded diagnostic design if attribution is still needed. A future read-only observation requires explicit separate authorization. It cannot unlock Execute, G1 or isolation admission. No security settings or historical laboratories were changed.
