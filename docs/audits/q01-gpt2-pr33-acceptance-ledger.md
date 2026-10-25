# GPT-2 Q01 independent acceptance ledger (PR #33)

Base candidate: `cb168925b5aeec0c957137dd94ab72c64f0bd333` (PR #31).
Scope: PR #28 detached rollback-journal pathname re-stat, without queue implementation changes.
Q01 remains OPEN. Production, deployment, merge and physical testing remain NO-GO.

## Evidence rules

A GitHub workflow `success` on a different SHA does not qualify this branch.
Require exact commit and tree, workflow run ID, attempt, matrix job IDs,
completed conclusions, source/test inventory, and raw test output for each
required cell. Queued, skipped, cancelled and absent cells are not PASS.
Distinguish synthetic Windows symlink evidence from real POSIX symlink evidence.

## Regression contract

- Only `queue.sqlite-journal` may receive one conditional pathname re-stat
  after a regular, nonsymlink `nlink=0` observation.
- ENOENT on re-stat may be accepted as disappearance of a transient journal;
  EACCES and other errors must not be silently accepted.
- Persistent detached journal, hardlink, symlink and oversized replacement
  must fail closed. Real POSIX symlink and hardlink must be attested by the
  fixture itself; Windows synthetic symlink must be labeled as synthetic.
- Regular replacement must pass all existing safety checks and preserve
  `PRAGMA integrity_check=ok` and expected metadata/job counts.
- Main database, WAL and SHM must never inherit the detached-journal exception.
- First-open multiprocess contention, lease fencing, interrupted transaction
  recovery and data preservation require independent stress/fault evidence.
  Passing the detached-journal matrix alone does not close Q01.

## Unresolved acceptance

P0: no exact-head complete first-open + crash + lease acceptance evidence.
P1: real POSIX filesystem regressions added but not yet independently green
on PR #33 exact head across Linux/Windows Node 22/24.
P2: full tree/attempt/artifact digest attestation remains to be collected.

No production source edits are included in this audit branch.

## Infrastructure and portability cross-check (2026-10-25)

Current reviewed heads:
- PR28: `1993f23b6418b2359cf6aeaaa3730cb454b75ea5`
- PR31: `cb168925b5aeec0c957137dd94ab72c64f0bd333`
- PR33: branch `audit/q01-pr28-real-symlink-20261025`; use current GitHub head, never this document as self-reference
- PR43: `d30eab8eb9b89fe8da018dcd136125714029b072`
- PR44: `e72d7f1e438d3d8873eacad8fdfc6dd78553d7be`

PR43 explicitly reports Windows EPERM/EACCES symlink fixture creation as BLOCKED/SKIP.
This is acceptable reporting, but cannot satisfy a required real Windows symlink
negative test. PR33's Windows symlink branch is also synthetic, and its
`synthetic-windows` receipt must not be presented as a real NTFS test.

PR44 has a distinct base (PR41 harness branch, not PR31) and its local
`-Execute` remains unconditionally blocked pending isolation review.
Its native harness is not a substitute for Book Queue first-open stress,
SQLite crash durability, real Windows symlink tests or a production gate.
Do not cherry-pick infrastructure evidence across these source trees.

Required acceptance table, per exact integration SHA/tree:

| Gate | Required evidence | Failure policy |
| --- | --- | --- |
| Detached journal | 4 OS/Node jobs, real POSIX symlink/hardlink, nlink=0/ENOENT/replacement, full test counts | Missing/skip = BLOCKED |
| Filesystem | primary DB/WAL/SHM fail closed, real path identity and replacement controls | Any false accept = FAIL |
| SQLite durability | integrity_check, row/metadata preservation after kill/rollback and reopen | Any loss = FAIL |
| Concurrency | independent process first-open barrier with bounded repetitions and failure logs | Any unexplained error = OPEN |
| Leases | stale token rejection, single owner, expiry/reclaim, crash recovery | Any stale acceptance = FAIL |
| Windows fixture | explicit real NTFS link evidence or separate BLOCKED marker | Synthetic != PASS |
| CI provenance | commit, tree, run/attempt/job, complete logs and artifact digests | Wrong SHA = NOT APPLICABLE |

No new runtime bug was proven by this cross-check. No change to `queue.mjs`
is justified without a reproducible RED and exact-head GREEN.
