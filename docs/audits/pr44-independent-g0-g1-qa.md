# Independent G0 / G1 QA — PR #44 (2026-10-25)

## Exact candidate and authoritative hosted runs

- PR #44 head: `e72d7f1e438d3d8873eacad8fdfc6dd78553d7be`
- Git commit tree: `724134b6c61b34c54ef72e4119b5966148f48659` (GitHub Git commit object)
- Candidate base: PR #41 HEAD `280096ab24ce4f32cdaf17bd4a928f66f4f2dbda`
- Push run: https://github.com/YehorBabenko88/math/actions/runs/40195832471 — `push`, attempt `1`, expected head as above
- PR run: https://github.com/YehorBabenko88/math/actions/runs/40195836730 — `pull_request`, attempt `1`, reported head as above
- Workflow: `ADMINIT Synthetic Harness Qualification`; source file `.github/workflows/adminit-synthetic-containment.yml`

## Independent job census at 2026-10-25T13:33Z

Each run exposes exactly five jobs: contracts Ubuntu Node22, Ubuntu Node24, Windows Node22, Windows Node24, and `Disposable Windows / Framework / actual Medium token`. All ten jobs are `queued` with `runner_id=0`, empty `runner_name`, zero steps. Neither run has an artifact. GitHub last update equals creation time (13:02:52Z push; 13:02:55Z PR). The evidence proves no runner assigned; it does NOT prove an underlying cause (quota/billing/capacity/permissions/administrative restrictions). No native case has executed; no JUnit, PID, FILETIME or process termination proof exists. No artifact checksum or inventory can be accepted.

## Required verification, not an assertion of success

1. Independently re-fetch both run details, attempts and **all pages** of jobs/artifacts; confirm `head_sha`, `run_attempt`, workflow path, actor, push vs PR event and expected source tree. PR checkout can use a merge tree; check actual checkout commit and tree separately before promoting evidence.
2. For each of four matrix cells in each run: terminal completed/SUCCESS with no mandatory SKIP/FAIL/CANCELLED; inspect test output, failed and skipped count, and job step conclusions.
3. For the hosted Windows native job in each run: verify successful compilation, exact package identity, verified Medium token (elevation 0, integrity RID8192), all five scenarios `normal`, `timeout`, `crash`, `assignment`, `cleanup` with per-case report and independent watchdog.
4. Validate process PID plus decimal creation FILETIME (no floating-point coercion), handle liveness, suspended-assignment-before-resume, descendant drain, timeout/kill, owner crash and cleanup rejection. Synthetic process reports are producer evidence; verify with independent runner logs/witnesses and fail closed if unavailable.
5. Download **original** package/native ZIP bytes, hash SHA256, validate exact inventory/paths/types, compare all manifest digests to bytes, prohibit symlinks/hardlinks/traversal, check no raw username/hostname/absolute paths/DSNs/tokens/stack traces or private environment leakage. Redact published diagnostics.
6. Require native job SUCCESS and report PASS for all five scenarios, zero missing/skipped required cases and consistent source/tree/run/attempt/job identity before labeling hosted synthetic PASS. Artifact upload alone is never PASS.

## Immediate concerns and acceptance boundary

- **P1 / BLOCKED:** no runner assignment for ten jobs and no hosted artifacts; cannot promote native status.
- **P1 / privacy review:** committed `docs/audits/adminit-synthetic-local-evidence.json` stores base64 original TAP outputs including Windows absolute user directory paths, username and stack fragments (see `contracts-red.tap` and `package-red.tap`). Base64 is encoding, **not redaction**. Requires sanitized replacement with minimum outcome/digest metadata or withholding sensitive artifacts; inspect any earlier public exposure separately.
- **P2 / evidence semantics:** hosted manifest `localExecution=BLOCKED_PENDING_ISOLATION_REVIEW` is correct; G1 stays closed even if hosted synthetic eventually passes.

## Verdict

| Gate | Verdict | Rationale |
|---|---|---|
| Exact source HEAD/tree | PASS as GitHub Git object lookup | Independent run-checkout tree not yet verified |
| Push and PR queued jobs | QUEUED / BLOCKED | Ten jobs, zero runner assignment |
| Node22/24 Windows/Linux contracts | NOT_RUN | All queued |
| Hosted five native scenarios | NOT_RUN | Native job queued |
| PID / FILETIME / drain / cleanup | NOT_RUN | No native report |
| JUnit / JSON / ZIP SHA256 / privacy of hosted artifacts | NOT_RUN | Zero artifacts |
| G0 hosted synthetic qualification | NO-GO | No terminal successful evidence |
| G1 physical/local Execute | CLOSED / NO-GO | No physical tests authorized |
| Q01 | OPEN | Prior BOOK_QUEUE_INITIALIZING P1 remains retracted |

No merge, deployment, production database or physical-machine operations performed.
