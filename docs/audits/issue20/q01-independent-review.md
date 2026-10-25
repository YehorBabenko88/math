# Q01 independent cause and minimal correction review

Reviewed read-only 2026-10-23. Q01 remains OPEN. No local queue execution, physical Windows/Job Object tests, production DB use, or branch/PR mutation.

Scope: original queue source at base 20ede51; hosted diagnostic head 19c73849795ef9965c34d14bd6b1de8c33d2e7b7; deterministic regression head 9816ded37882b0f5a59d0fdf956c7f69259623b0. No production correction existed at reviewed regression head (git diff from base contains only workflow and three test files).

Findings: no P0 or P1 identified in the proposed narrowly bounded correction. Conditional approval for implementation review, not acceptance or closure.

Evidence independently inspected:
- copy-3000 node22/node24 manifest hashes match all six events/report/JUnit files locally. Hash integrity is not independent authenticity or live GitHub attestation.
- Exact diagnostic commit scripts/q01-lab/passive-source.mjs:4-24 normalizes LF, pins original queue SHA256 d7507146007bf1f2e1c2635c89f85966e32b9cd2e77132ed78d6a3254c5525ca, rejects ambiguous replacements, adds error-only receipts, and resolves original contract/text through file URLs. The filesystem and SQLite imports remain native.
- Exact worker.mjs:19 imports the transformed data URL only under copyPassive. cases.mjs:18 selects copyPassive without hook. run.mjs:53-55 supplies --import preload only for config.hook, and constructs a controlled environment; therefore this copy profile does not enable filesystem/SQLite loader probes.
- Node22 unsafe-storage events seq18801,25306,46475,56364 precede transaction-error Unsafe queue storage; Node24 seq59315,61908 precede directory-error Unsafe queue storage. All six identify queue.sqlite-journal, regular=true, symlink=false, links=0,size=512. At original queue.mjs:25 this makes nlink===1 the sole failing conjunct; size passes. Original outer directory catch :47 redacts to Invalid queue directory; transaction catch :75-77 redacts to Invalid queue state, explaining the different public failures.

Causality: strong direct evidence for the immediate cause of these six instrumented-copy failures. It does not establish that every prior uninstrumented Q01 failure shares this cause. The transformed module changes timing; native filesystem completion and the deleting actor are not traced, and the event does not identify a kernel or SQLite defect. The evidence is consistent with concurrent legitimate rollback-journal deletion, rather than proof of the precise OS schedule. No second-path lookup was captured yet; its success is prospective.

Required correction contract at src/book-ingestion/queue.mjs checkFiles :23-27:
1. Only exact queue.sqlite-journal and first Stats isFile(), !isSymbolicLink(), nlink===0 may trigger exactly one immediate lstatSync of the same joined path.
2. Apply all original regular-file, nonsymlink, nlink===1 and <=32MiB checks to the second Stats. ENOENT uses the existing outer catch; all other errors, including EACCES, reject.
3. Never broadly retry openBookQueue, SQLite transactions, main/WAL/SHM checks, or initial symlink/hardlink/nonregular files. A second detached result must reject.
4. No inode equality requirement: a legitimate new journal can replace the removed inode. No reads/writes/deletes, sleeps, or repair are necessary.

Security/race limits: revalidation does not make pathname checks atomic with SQLite open. A malicious actor with directory write access can already swap a path after a successful original check. The bounded change adds a new accepted transition from a detached observation to an absent or normally validated current pathname; it must not be described as hostile-directory safety proof. A second lookup can race with another delete and safely reject a second links=0 observation, so residual availability failures remain possible by design. Retaining fail-closed bounds is preferable to an unbounded retry.

Regression review (9816ded): tests/helpers/detached-journal-fs.mjs:8-12 obtains real native unlinked-inode Stats using open/unlink/fstat and returns it at only the queue module filesystem import boundary; preload :4 scopes resolve interception to queueURL + node:fs. This is controlled deterministic boundary simulation, not reproduction of native lstat timing. Tests/book-queue-detached-journal.test.mjs:10 covers vanished journal at both initial and transaction checks, :11 fresh regular replacement, :12 hardlink/oversized/persistent/EACCES/synthetic symlink failure, :13 rejects detached main/WAL/SHM. Success checks count, metadata cardinality and integrity.

P2 test-evidence limitations:
- Helper :20 returns synthetic symlink-shaped Stats rather than creating a symlink. This verifies the branch predicate, not native symlink handling; existing native guard tests or hosted real-symlink coverage should remain part of acceptance.
- Unsafe replacement matrix currently exercises phase1 only. Phase2 would validate public transaction redaction to Invalid queue state as well as the same shared checkFiles guard. This is useful supplementary coverage, not evidence of a production defect.
- No negative regression explicitly counts zero retries for initially linked hardlink, symlink, or nonregular journal observations. Existing guards must be diff-reviewed, and preferably their existing tests retained.

Acceptance still required after actual source diff: hosted RED receipts bound to 9816ded; source-only bounded correction review; hosted GREEN deterministic tests; unchanged applicable safety/corruption tests; exact-head native no-hook concurrent first-open reruns with integrity/cardinality/lease checks; artifact manifests and provenance validation. A finite successful run only bounds observed failure rate. Physical Windows and production acceptance remain outside these Linux receipts.

## Actual production diff review, 2026-10-25

Exact reviewed HEAD: 1993f23b6418b2359cf6aeaaa3730cb454b75ea5 in work/math-q01-detached-journal-20. Compared against harness-only predecessor b0a51d2: one changed production file, src/book-ingestion/queue.mjs, 7 insertions / 1 deletion. git diff --check passed. No queue execution was performed.

Verdict: actual implementation satisfies the proposed narrow correction contract; no P0/P1/P2 production defect found in this diff. This is source-review approval only. GREEN CI/native stress/independent acceptance remain pending and Q01 stays OPEN.

At queue.mjs:25 the same joined pathname is assigned once and used for both lookups. At :30, a single conditional second lstat occurs only for the exact rollback-journal filename with regular=true, symlink=false, nlink===0. No loop, sleep, or retry surrounds it. At :31 both original guards run against the final returned Stats, including nlink===1 and the size bound; the existing outer catch ignores ENOENT and propagates EACCES/other failures. Main/WAL/SHM fail the name predicate and retain original rejection. No SQL, initialization, write, recovery, timeout, transaction, or error-redaction behavior changed. A second nlink=0 remains rejected.

The first detached Stats size is intentionally not checked before retry: the accepted object is the second lookup or absence, and all current-object guards remain enforced. A detached oversized inode that has disappeared is not evidence that the current pathname is oversized. This does not broaden acceptance of an existing oversized replacement.

Minor wording limit, nonblocking: :26-27 says COMMIT "may" unlink between native lookup and getattr. The receipts support detached Stats and the branch cause, but do not trace those exact kernel stages or establish the deleting actor. Preserve this as a possible explanation, not a proven schedule in acceptance claims.

Harness delta 9816ded..b0a51d2 changes --import from a Windows absolute path to a file URL and adds restricted startup diagnostics; production source unchanged in that delta. Read outputs/detached-journal-red-ci.txt: Linux Node22 and Node24 each report 3 pass/8 fail, with intended phase1 Invalid queue directory and phase2 Invalid queue state failure messages. Windows each report 0 pass/11 fail, so original Windows RED is startup-failure evidence only and cannot establish production branch behavior. The local log file is not by itself independent run/SHA attestation; root-supplied run40016857082 identity was not independently fetched during this review.

Existing P2 test-evidence limits above remain: synthetic symlink replacement, unsafe matrix phase1 only, and no explicit initial-unsafe zero-retry count. These do not block this minimal source diff but should be reflected in the acceptance evidence. Prior note "no production correction existed" applies only to reviewed regression head 9816ded, superseded for the present HEAD.
