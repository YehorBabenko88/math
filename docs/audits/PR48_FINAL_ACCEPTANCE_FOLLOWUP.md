# PR48 independent acceptance follow-up

Original candidate: `02b37515c8aa13154362c3108132857677b8fe5a`, tree `54c89f1d20385f1a86f2e7f016d123f596497818`. This report is a separate successor; original branch and historical evidence were not rewritten. Reviewed implementation commit: `a04a9d1ccb614a710e17761e922fc67d2b049fbc`; subsequent changes add the CI publication check and audit documentation only. The delivery commit identifies the final report and tree externally (a report cannot contain its own commit hash).

## Findings and dispositions

- P1 test execution defect: PR45 contained an invalid regular expression (Invalid regular expression flags). Reproduced with Node syntax checking before editing. Separate Draft PR49 fixes it: `94704f690a84ae172524279a517dd36277ff0c3a`, 6/6 tests on Node22/24. Only corrected narrow assertions and the syntax regression were ported here.
- P2 contract hardening: full 40-character blob OIDs are now retained and validated. Missing, truncated and wrong-length OIDs fail; real Git-backed parser coverage prevents capture-index mistakes. RED 5 PASS/3 FAIL, GREEN 9 PASS per runtime. No exploitable provenance bypass was demonstrated in PR48; this is defense in depth, not a claim that PR46 repairs a proven exploit. No SHA256-repository compatibility claim.
- P2 current publication scope: local account/workspace paths survived PR47 in five locations across four reports. Forward redaction and bounded tracked-evidence policy tests cover these and reject nonempty nested content/data/base64, identity fields and long encoded candidates. Originals remain in historical Git objects; this does NOT erase Git history. No credential disclosure was established. Future runtime stdout, TAP, JUnit and artifact contents remain separate private-review surfaces. The checker is not a repository-wide or runtime privacy certification.
- P2 acceptance gap: independent watchdog forced-expiry acceptance remains unproved. Five native-case PASS results alone would not prove that extra property.

## Evidence and acceptance matrix

| Layer | Result | Scope |
|---|---|---|
| Local Windows Node22.23.3 | 314 PASS / 0 FAIL / 5 SKIP | 42 selected pure test files; not the complete PostgreSQL/PDF/browser suite |
| Local Windows Node24.20.0 | 314 PASS / 0 FAIL / 5 SKIP | Same selection |
| Local mock containment | PASS | 23 sequencing/cleanup traces, compilation, drain-exception assertion; zero native calls |
| Local Execute policy mock | PASS | Fail before filesystem/native effects; scripts parse |
| SQL checkout | PASS | All 11 historical files; no SQL or ledger changed |
| Dependency lock policy | PASS | No dependency/lock changes |
| Current tracked publication policy | PASS | Bounded current document surface only |
| Original PR48 hosted | QUEUED / NOT_RUN | 21 runs, 76 jobs, attempt1 at retained snapshot; refreshed status remains 21 QUEUED |
| Hosted artifacts/native | BLOCKED | Zero available artifacts/steps in snapshot; no package digest or native PASS inferred |
| Physical ADMINIT | NOT_RUN / BLOCKED | No native, Q01 or PostgreSQL execution |
| Isolation | BLOCKED | Entire-PC test designation is scope, not independently measured isolation |

Five local skips remain explicit: denied symlink fixtures and a POSIX-only mode check. No unavailable test is counted PASS. Local logs and their hashes are retained separately; public hash-only records are in `pr48-followup/local-evidence-sha256.json`. Original hosted metadata hashes, run IDs, job IDs and attempts are in `pr48-followup/original-pr48-hosted-snapshot.json`. No reruns or dispatches were requested. Exact PR45-48 HEAD/tree values are in `pr48-followup/source-heads.json`.

Native follow-up: see [acceptance packet](pr48-native-acceptance-packet.md). Verify the completed exact source/run/attempt/job and downloaded ZIP/package hashes before interpreting runtime results. PR merge source identity must be distinguished from push HEAD. Self-reported provenance is not independent attestation. No hosted artifact inventory can currently substantiate runtime privacy, containment or native qualification.

## Decision

Conditional code-review candidate only. Independent hosted/native acceptance remains BLOCKED by pending CI and missing artifacts. No new regression observed within the local tested scope; this does not establish full integration correctness. Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book production gate CLOSED. No physical execution, source-tree replacement, system configuration change, production migration, deployment or merge authorized by this report.
