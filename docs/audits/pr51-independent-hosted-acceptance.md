# PR #51 — Independent hosted G0/G1 and runtime privacy audit

Observation date: 2026-10-25. Candidate HEAD `878c178bcf6d068f552f4c642820f42cad9a43a9`; Git tree `13b14e26570299c195afc8873d39704335848241`; base `88c4ce4d2880ec9d8dab96573fd37fb08720b2c5`. PR merge SHA `39adcc94cd7d0748463dddd9c516cd171902933f` is **not** interchangeable with head. Confirm actual checkout SHA/tree when jobs execute.

## Read-only GitHub API census

Eight pull_request workflows on candidate SHA, attempt 1, all QUEUED. 31/31 jobs QUEUED, 0 assigned runners, 0 executed steps, 0 artifacts. No FAIL/SKIP/CANCELLED or native PASS was observed. Breakdown: ADMINIT 5, Q01 reliability 13, PG integration 4, Q01 Windows containment 4, Windows deployment 2, Book PDF 1, Browser 1, Validate 1. This establishes scheduling non-assignment but not its cause. Do not rerun until a cause or explicit remediation decision is established. Investigate GitHub Actions eligibility, account/billing/usage/abuse flags, repo permissions, workflow approval requirements, concurrency, status incidents and GitHub Support runner-acquisition telemetry; no single hypothesis is proven.

## Native qualification

Fixed five native cases `normal`, `timeout`, `crash`, `assignment`, `cleanup` plus forced watchdog negative probe. Source contract requires forced watchdog `BLOCKED` (not PASS), waitResult 258, live-before-expiry, owner/root/leaf distinct PID, creation FILETIME, signalled handles, assigned-before-resume and outer cleanup. `WAIT_FAILED` is rejected by mock classification. These are source/model checks only. Native runtime, independent watchdog, JUnit, report, process drain and full ZIP checksums are NOT_RUN; artifact identity BLOCKED.

## Confirmed P1 runtime privacy issue and isolated remediation

Candidate `AdminitSynthetic.cs` printed the complete `results.json` to GitHub Actions stdout. It includes token SID, lab ACL and process identity fields. The workflow also uploaded raw `adminit-native/`, bootstrap stdout/stderr and process JSON. This is a direct runtime publication path; absence of artifacts today does not remove the risk. In this Draft PR, replace stdout with a fixed status line and exclude raw runtime reports/bootstrap streams from the public upload, retaining only digest/source metadata. A regression test enforces stdout policy. **Tradeoff:** no public raw native evidence remains for independent five-case acceptance; therefore hosted native G0 remains BLOCKED until a separately approved private evidence transport, independent reviewer and sanitized public projection are implemented. This change does not retroactively remove earlier published data, if any.

## Acceptance

| Gate | Result |
| --- | --- |
| GitHub HEAD/tree | PASS for source object identity |
| Eight workflows, 31 jobs | QUEUED / BLOCKED |
| Native five-case and forced watchdog runtime | NOT_RUN |
| JUnit/JSON, PID/FILETIME/drain | NOT_RUN |
| Artifact SHA256/inventory and privacy | NOT_RUN (zero artifacts) |
| G0 | NO-GO |
| G1 | CLOSED / NO-GO |
| Q01 | OPEN |
| Production | NO-GO |

No merge, rerun, deployment, production database access, physical tests or local Execute.

## Follow-up privacy hardening

The first isolated privacy patch still published `evidence-sha256.json` containing a raw list of runtime file paths. The follow-up replaces that public inventory with a digest-only private-inventory summary, file count, and explicit `nativeAcceptance=BLOCKED_PRIVATE_EVIDENCE_REQUIRED`. Raw inventory remains on the disposable runner and is not uploaded. A digest-only receipt does not establish independent native acceptance; private evidence transport and review remain required. No hosted execution is claimed.
