# PR50 final qualification follow-up

Baseline PR50 HEAD `88c4ce4d2880ec9d8dab96573fd37fb08720b2c5`, tree `0903673b47d750487cf239c349c1069cca523490`. Independent [comment6399112062](https://github.com/YehorBabenko88/math/pull/50#issuecomment-6399112062) was read: source review, not reproduced full-suite/native acceptance. Original PR50 unchanged. Isolated branch `test/pr50-watchdog-qualification` starts at that baseline.

Implementation `64678015a3b0caf1b968f408300f47555c2b1690`, tree `6fbe88ddbf06993d5237dba3a92c21aa11a8a61d`. Final delivery adds documentation/hash metadata only; final HEAD/tree are reported externally, not self-embedded.

## Forced watchdog and review

Fixed synthetic watchdog scenario stays in the existing disposable hosted suite. ADMINIT rejection, actual Medium token, fixed fresh lab, restricted bootstrap and Execute guard are unchanged. No arbitrary executable/arguments or timeout environment override.

The supervisor captures live root/leaf handles with PID/creation FILETIME and checks membership witness. Readiness barrier precedes the SAME owner deadline helper used normally with25000ms, forced with0ms. Only WAIT_TIMEOUT=258 means expiry; WAIT_FAILED and every other unexpected result fail closed. Both paths use the SAME finally: terminate outer job, require zero active job processes, check captured handles signalled, record identities before closing. Cleanup errors prevent proof returning.

The forced outcome is **BLOCKED**, never a sixth native PASS. Five original functional cases stay separate. New native qualification requires this negative proof and rejects legacy five-case-only reports; historical evidence remains unchanged. CLI explicitly reports forcedWatchdogStatus=BLOCKED. Successful negative-test verification is not local execution permission.

Boundary: this prepares expiry of the supervisor external to the owner. It does NOT force the separate bootstrap120-second or PowerShell150-second whole-suite deadlines. Those independent runtime qualifications remain outstanding. No Main/native execution occurred locally.

RED/GREEN evidence:

- Missing watchdog contract/proof RED, then model GREEN.
- External tree mismatch RED: previous package API ignored supplied external tree. Additive external tree binding GREEN; hosted workflow now supplies it. Legacy calls without that optional argument are not independent tree qualification.
- Independent review found first version duplicated timeout cleanup. Shared-path RED regression then one deadline/helper/finally.
- Review found WAIT_FAILED could masquerade as expiry in the first refactor. Pure C# RED then GREEN:0/258 classified, maxuint/1/128 rejected. Main/native methods never invoked.
- Missing-proof legacy report RED then GREEN; original assertions retained.
- Expanded OID negatives: type/length/case/nonhex/newline/NUL/tree identity. Expanded pinned-package negatives: traversal, size, digest, metadata and external tree mismatch.
- Final independent subagent review: no remaining P1/P2 in reviewed changes; hosted/native behavior explicitly unverified.

## Acceptance matrix

| Scope | Result |
|---|---|
| Local Node22.23.3, 43 selected pure files | 343 PASS / 0 FAIL / 5 SKIP |
| Local Node24.20.0, same selection | 343 PASS / 0 FAIL / 5 SKIP |
| PowerShell5.1 compile-only | PASS, Main not called |
| Pure C# wait classification | 5 PASS, zero native calls |
| Existing sequencing/cleanup mock | 23 traces PASS, zero native calls |
| Execute guard/parser mock | PASS |
| SQL checkout / dependencies / diff check | PASS; 11 historical SQL files unchanged |
| Exact original PR50 snapshot | 15 QUEUED runs / 57 QUEUED jobs / 0 artifacts, attempt1 |
| Hosted PG/PDF/Browser/Windows/native | NOT_RUN/QUEUED; no fresh PASS |
| ZIP safety, SHA256/source/run/attempt/job binding | BLOCKED: no artifacts |
| Physical ADMINIT / isolation acceptance | NOT_RUN/BLOCKED |

Five skips remain denied-symlink/POSIX fixture limitations, never counted PASS. This is not a full unfiltered PG/PDF/browser run. No rerun or dispatch requested. Normal CI for a new source PR does not replace original queued evidence.

## Evidence, privacy and admission

[Hosted metadata](pr50-qualification/hosted-snapshot.json) retains exact run/job/source/event/attempt/status/artifact inventory and private metadata hashes. [Local hashes](pr50-qualification/local-evidence-sha256.json) bind privately retained RED/GREEN/TAP/compile files. Hashes establish byte identity, not correctness; no ZIP digest invented.

[Runtime surface inventory](PR50_RUNTIME_PUBLICATION_SURFACES.md) covers all workflow upload declarations plus console/collector output, identities, Q01/QA JSONL/JUnit/TAP, browser images/traces, packages and provenance. Actual contents remain unverified. Tracked-document policy does not cover these streams or Git history. No claim of runtime privacy certification or historical erasure.

[Read-only isolation packet](ADMINIT_READONLY_ISOLATION_PACKET.md) prepares token/ACL/network/service observations without database traffic or settings changes. Not executed on ADMINIT. Snapshots do not establish effective isolation. Execute stays closed pending independent isolation acceptance AND separate explicit physical admission.

## Decision

GO for independent code review only. Hosted/native and physical acceptance BLOCKED. Wait for ORIGINAL jobs, then use authorized read-only transport: bind source/event/run/attempt/job, inventory ZIP safely before fresh extraction, verify API/download/member/package digests independently. Reject stale, skipped, cancelled or missing evidence. Producer self-reports are not independent attestation. Qualify whole-suite watchdog separately.

Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED. No original PR update, main merge, physical execution, historical laboratory/PostgreSQL/system change, deployment or cutover.
