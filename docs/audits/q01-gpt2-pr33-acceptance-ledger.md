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
