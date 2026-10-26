# G0 CSV compatibility and physical producer-format boundary

Date: 2026-10-26. Control PR71 HEAD151c77fa2e6ec0b20210bd8b6d1101225120eea2, treeba18637a172e1017b7e94954fb666fcfcd527dbe remains unchanged.

## What was reproduced

The initial summary (13 records, a 10-quote record with one escaped quote, separate Medium SID) was insufficient to prove a parser defect. A valid synthetic first field with a single escaped internal quote already passes the original PR71 implementation in PowerShell5.1 and7: two baseline tests PASS before any source change.

The subsequent operator-provided anonymous structure contains a lone quote before an internal word and a pair after it. This differs from proper doubling of each internal quote. A structurally equivalent fixed synthetic row reproduces UNKNOWN in both PowerShell versions, while ConvertFrom-Csv leniently returns four properties. Four properties do not establish correct field-boundary preservation.

Examples (synthetic only):

```text
Rejected producer shape: "Synthetic group "unescaped"","Group type","S-1-5-21-1","Enabled, status"
Accepted canonical form: "Synthetic group ""escaped""","Group type","S-1-5-21-1","Enabled, status"
```

RFC4180 section2 requires each internal quote in a quoted field to be doubled: https://www.rfc-editor.org/rfc/rfc4180.html#section-2 . We do not silently repair, discard or skip a malformed producer row. The reported physical input remains BLOCKED/UNKNOWN under the requested strict boundary policy. This is not a claim that the actual Windows token is High or invalid. Actual raw ADMINIT CSV was not supplied or queried; only the operator's anonymized syntax was used.

The existing input contract remains the bounded four-quoted-column whoami dialect, not a new general-purpose RFC CSV parser supporting arbitrary unquoted/multiline records. Correct escaped quotes and commas in quoted display fields are preserved by the existing lexer and ConvertFrom-Csv. No claim is made that we fixed a previously rejected valid escaped-quote record: that hypothesis did not reproduce.

## Confirmed hardening defect and minimal fix

A separate negative case DOES reproduce: a malformed or ambiguous third-column SID in one row was silently ignored if another row contained the valid Medium label. A dataset could therefore receive token PASS despite an invalid SID column. RED: two Windows PowerShell profiles reject the new assertion on the old code. GREEN: validate every third-column value as canonical SID text, including SID component range validation through the local .NET SecurityIdentifier string constructor, before counting integrity labels. No account-name resolution or machine/token lookup is performed.

The existing strict CSV shape regex is unchanged. SID selection remains third-column only. Unknown extra fields, missing fields, unbalanced quotes, invalid SID components, padded/compound/escaped SID text, duplicate identical Medium labels and mixed High/Medium labels yield UNKNOWN. High or Low alone yields FAIL; enabled admin role still yields FAIL. No row skipping, quote normalization, field trimming, fallback delimiter inference or lenient authorization was added.

## Test evidence

|Scenario|PS5.1|PS7|Meaning|
|---|---|---|---|
|13-line valid CSV with one escaped quote, before source change|PASS|PASS|Original implementation already compatible|
|Anonymous malformed quote-shape -> UNKNOWN; canonical counterpart -> PASS|PASS|PASS|Reproduces physical reported rejection; remains intentional|
|Ambiguous SID with valid Medium row, RED|FAIL|FAIL|Confirmed complete-row validation gap|
|Same negative set after canonical SID validation, GREEN|PASS|PASS|Malformed datasets rejected|
|High, active admin, duplicate labels, extra/missing fields, SID outside column3|PASS|PASS|Fail-closed assertions preserved|

Final explicitly enumerated29-file suite: Node22.23.3 219 PASS/0 FAIL/0 SKIP; Node24.20.0 same. Includes PowerShell5.1/7 parser-only and pure helper fixtures; no collector invocation, whoami/native EXE, Q01 stress, full npm test, database/service/system configuration action or ADMINIT access. Existing finite temporary SQLite contract tests are included, not physical Q01. On Linux the ten Windows-only parser/helper/CSV tests are explicit SKIP, never qualification PASS.

Private local evidence hashes: EVIDENCE_HASHES.json. Raw child diagnostics/logs are not published. git diff --check and tracked-document publication policy pass; this is not a blanket runtime privacy attestation or history redaction.

## Acceptance and next step

GO for independent review of regression coverage and canonical SID hardening only. The requested physical producer compatibility is NOT declared resolved: the supplied shape is malformed under the retained strict contract. A future trusted structured token-query adapter or separately designed producer-specific format would need independent review; do not bypass the bad row merely because the operator says it is non-integrity.

No positive admission path changed. g0.mjs still emits isolationConfirmed=false, localExecute=false, admission=BLOCKED. Source PR71 and historical evidence remain untouched. Only narrow contract CI is enabled for this branch; issuer/native/full/stress jobs remain skipped. No rerun or cancellation requested.

Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED.
