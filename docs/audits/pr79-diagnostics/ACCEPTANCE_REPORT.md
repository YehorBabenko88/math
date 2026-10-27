# Bounded G0 Token API diagnostic contract

## Design and decision

Exact base: Draft PR79 HEAD `a6fc45c04fd382e6ace5751e150fb7dd1efe728c`, tree `ad1047fcd0af122079698e2c4793a71ed6ba1a19`. This isolated successor does not modify PR79 or its evidence. Candidate identity is the containing Draft PR head, independently verified after push.

Production emits `math.g0.token-api.v2`. It retains every original field and adds two mandatory strings from closed enum sets: `diagnosticStage`, `diagnosticCategory`. The strict Node validator accepts exact historical v1 objects without these fields, and exact v2 objects with both fields. Mixed versions, additional keys, malformed values and impossible code/stage/category combinations are rejected. Older v1-only consumers will reject v2: update the matching producer and validator together. No implicit downgrade or retry exists.

A new context is allocated once per observation and passed through helpers. No static mutable diagnostic context, thread-local state, raw native error capture or diagnostic event buffer is introduced. Diagnostic decoration never edits code/status/authority. Successful observations carry NONE/NONE. Errors remain UNKNOWN with null token details. UNKNOWN/UNKNOWN is reserved for the pure unavailable-policy factory, where no API stage was observed; it is not inferred evidence of an API call.

| Stage | Meaning |
|---|---|
| Q1 | Initial token statistics |
| Q2 | Integrity label |
| Q3 | Elevation |
| Q4 | Token type |
| Q5 | Group membership |
| Q6 | Final statistics on original handle |
| Q7 | Reopened current primary token/statistics, including helper close |
| T1 | Thread-token check before opening primary token |
| T2 | Thread-token check before final statistics |
| T3 | Thread-token check after current-primary statistics |
| OPEN | Initial primary-token open |
| POLICY | Pure classification/identity comparison |
| CLEANUP | Final managed cleanup or primary-handle close |
| LOAD / OS | Wrapper load rejection / unsupported OS |
| NONE / UNKNOWN | No error / location not observed by pure factory |

Categories: NONE, UNKNOWN, OS, LOAD, OPEN, PROBE, READ, BOUNDS, CLOSE, CLEANUP, IDENTITY, IMPERSONATION, INTERNAL. PROBE includes thread-open absence verification; READ denotes the allocated-buffer API call; BOUNDS includes probe bounds, allocation return checks, response-length checks and structural/policy format validation. CLOSE is a handle-close failure; CLEANUP is a managed-clear or query-buffer disposal failure. Diagnostic metadata describes the decisive failure, not every prior error. A later close failure preserves E_CLOSE priority and replaces the diagnostic pair with that close site. No new collection of native error numbers, identity, handles, paths, token bytes or private data occurs.

The six P/Invoke declarations, query-only access, maximum query size, no-impersonation rules, P1 AdminState mask and P2 all-array finally cleanup are preserved. Last-error is still consumed on the original failed probe/thread-open paths before another native call. Splitting combined rejection predicates adds location detail without changing their outcome. Final primary-handle closure reuses the existing context; it allocates no new context before attempting close.

## Consumer boundary

`g0-token-api.ps1` explicitly projects only approved v2 fields and uses fixed LOAD/LOAD or OS/OS for unavailable results. The standalone producer and Node CLI still exit 2 even for a narrow observation PASS. Rejected CLI input emits only the existing fixed blocked message, never the rejected value.

`collect-g0.ps1` is unchanged. It consumes only tokenObservation.status and retains its reduced composite v1 observation; it does not copy the diagnostic object into public G0 evidence. Its parser is checked in both PowerShell profiles without executing the collector. Diagnostics must be consumed through the dedicated producer/validator; neither that JSON nor the composite snapshot is independent attestation or admission.

## RED/GREEN and test results

RED before implementation: new v2 contract/CLI cases failed; both fake-native compilers rejected missing diagnostic properties. Four tests failed, three passed. This demonstrates an absent feature, not reproduction of the physical E_QUERY cause.

GREEN: all original 135 scenarios per PowerShell engine remain. Two combined failures were added: query read failure followed by close failure; managed-array cleanup failure with close failure. Total 137 per engine / 274 across PowerShell5.1 and7 per Node run. Every serialized result passes through the strict Node validator. Every original named fault has explicit expected code/stage/category. All 77 targeted query and 18 thread cases assert their exact pairs. Injection is marked only at the selected effect, addressing the earlier probe-only marker limitation.

Privacy negatives reject arbitrary stage/category strings, wrong types, missing/extra fields, mixed schemas, raw-error/private fields and forged PASS/unlock claims. CLI negatives require empty stdout and fixed stderr. Existing E_QUERY/E_FORMAT/E_CLOSE/E_CHANGED/E_IMPERSONATION and cleanup assertions are retained. The preloaded-type load guard is exercised after compile-only setup, ensuring no native API can be reached in that test.

Mutation RED: isolated source copies mislabeling Q5 as Q4, or CLOSE as READ, were rejected by both PowerShell synthetic tests. Mutants were not committed. Unmodified implementation is GREEN.

Local bounded 36-file suite:

| Node | PASS | FAIL | SKIP | Scope |
|---|---:|---:|---:|---|
| 22.23.3 | 236 | 0 | 0 | Synthetic/compile/pure contracts |
| 24.20.0 | 236 | 0 | 0 | Synthetic/compile/pure contracts |

PowerShell5.1 and7 parse/compile/pure/fake checks PASS. All six native declarations are removed before fake orchestration runs; unknown remaining declarations cause failure. Real source compiles in separate compile-only tests without Observe. git diff --check PASS. Public hash receipts identify private test transcripts without republishing paths or raw diagnostic streams.

CI is scoped to this successor branch: Windows/Linux Node22/24 contracts only; unrelated full/native/issuer/PostgreSQL/Q01-stress workflows remain excluded, not PASS. Linux expected: 220 PASS, 16 Windows-only SKIP, 0 FAIL. Windows expected: 236 PASS, 0 SKIP/FAIL. Exact-head hosted outcomes must be independently checked after push; prior HEAD SUCCESS is not successor acceptance. No raw evidence artifact is configured in the scoped workflow.

## Findings and unproven properties

P0: none confirmed in this bounded change. P1 operational blocker: the single authorized physical E_QUERY remains unattributed. P2 compatibility consideration: the schema changes to v2; deploy matching validator and producer, preserve historical records, and do not silently strip diagnostics. Static second review found no confirmed new P0/P1/P2; its diagnostic assertion gap was addressed with the explicit 40-case table.

Synthetic success does not prove actual Windows API return layouts, error propagation, failure of real CloseHandle/FreeHGlobal, successful secure wiping under native failure, same-user integrity, source independence, continuous isolation, or physical cleanup. Fatal process termination, allocation failure while creating an error object, and untracked runtime/GC copies are not qualified. The adapter remains a read-only observation, not a sandbox or authority.

No Token API call was repeated on ADMINIT. No native G1, stress, PostgreSQL, deployment, security-settings change or merge occurred. No automatic retry was added. A future physical diagnostic observation requires separate explicit approval and independent review of this exact candidate and privacy boundary. This PR alone does not authorize that observation.

Invariant: authority=NONE, isolationConfirmed=false, localExecute=false, admission=BLOCKED. Q01 OPEN; Physical G1 BLOCKED; Production NO-GO; Book gate CLOSED.
