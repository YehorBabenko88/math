# PR31 independent Q01 / filesystem compatibility review

Target: cb168925b5aeec0c957137dd94ab72c64f0bd333, tree 10cfd29f5d2c75e841d88dd70bef8773dada8287.

## Finding

No confirmed production defect found in the bounded rollback-journal correction. It rechecks only a regular nonsymlink queue.sqlite-journal with nlink exactly zero, once. ENOENT is accepted by the existing catch; linked regular replacement must satisfy nlink=1 and the 32 MiB bound. Hardlinks, symlinks, nonregular objects, repeated zero-link stats, EACCES and oversized replacements remain rejected. Main DB/WAL/SHM guards are unchanged. Public error remains Invalid queue directory at preflight, Invalid queue state inside transaction.

Existing check/use races against hostile same-user mutation remain: a later replacement after successful re-lstat can evade this pathname-only guard. This predates and is not solved by PR31; do not present this fix as secure filesystem isolation. Queue directory ownership/trusted operator boundary is still necessary. The correction does not change metadata initialization, schema handling, freeze, WAL journal mode, lease recovery or CAS token checks.

## Independent test enhancement

Isolated branch test/pr31-queue-independent-review, commit ffb87e47268075c669890e2438089a8be60dc99c, tree e2ff47d870dd768f21a0c805cad3addefc2234a4. Production files identical to target. No draft PR created because no confirmed production bug was found.

Controlled detached-stat regression count increases from 11 to 21. Both preflight and transaction phases cover hardlink, synthetic symlink, real filesystem symlink, oversize, persistent zero on recheck and denied recheck; main DB/WAL/SHM zero links are also tested at both phases. One conditional revalidation only is asserted. Real symlink fixture records native lstat isSymbolicLink=true. Real unlink/fstat supplies the initial detached inode; loader hook controls delivery at the queue boundary, so these are deterministic boundary regressions, not a native concurrency schedule reproduction. Existing regular replacement remains a phase1 test; disappearing replacement covers both phases.

Hosted Linux-only Node22/24 dedicated run: https://github.com/YehorBabenko88/math/actions/runs/40184470515 . Pending as of first report. It also runs existing book-ingestion-queue, cutover-hardening-sqlite, cutover-source/controller/backup/journal, sqlite-text suites. These cover corrupt bytes preservation, missing metadata/no repair, malformed JSON, failed CAS/leases/checkpoints, WAL readers/in-flight writer/frozen source and backup behavior. No local Windows queue or native test was run.

No new RED/GREEN claim: this is test enhancement against an already fixed production tree. Historical RED40180235290/GREEN40180263735 are separately documented baseline evidence, not executions of this test branch or PR31 exact tree.

## Prior causal receipts independently inspected

Retained docs/audits/issue20/q01-causal-receipts.json in math-stabilization-audit has six receipts: four Linux Node22.23.3 and two Linux Node24.21.0. Each records journal regular=true, symlink=false, nlink=0, size=512 and sanitized opener rejection. Source is separate diagnostic head19c73849795ef9965c34d14bd6b1de8c33d2e7b7. They establish the observed guard mechanism; deleting syscall/COMMIT timing was not traced. This review parsed retained receipts, without re-downloading or re-attesting hosted artifacts.

## Limits

Pending hosted results cannot establish PASS. Green deterministic boundaries cannot prove every concurrent interleaving. Physical Windows hosts, native Job Objects, production PostgreSQL, production migration/cutover, settings, merges and source PR edits were not performed. No production readiness assertion.
