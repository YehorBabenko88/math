# CI and release provenance report

Scope: independent branch `fix/ci-release-provenance`, baseline `8dd1186f3fc34fa0148eb137cb44fc2416321e7c`. Historical SQL is unchanged. No deployment, service operation, production database operation, merge, or settings change was performed.

## Findings and disposition

| Priority | Finding | Disposition |
|---|---|---|
| P0 | A release could rely on green job metadata without verifying downloaded source/dependency evidence. | Release gate now requires current-attempt provenance archives, verifies downloaded ZIP bytes against GitHub SHA256 metadata, and binds bounded manifest contents to exact source SHA, committed lock SHA256, repository, workflow path, run ID, attempt, and each producing job context. |
| P1 | All external Actions used mutable version tags; Pester version selection had no archive integrity check. | All checkout/setup-node/setup-python/upload-artifact references now use full commit SHAs. Pester 4.10.1 archive is checked against SHA256 `898210e1a30c52cd46ba317c2278a9324345214213aa2f7d6b7dfa7b98f37ac9` before extraction. |
| P1 | This independent baseline has no committed package-lock.json. | Intentionally unresolved here: evidence records qualified=false and lockSha256=null, even if npm install generated an untracked lock. Release gate fails closed before accepting checks. Dependency branch must be separately integrated and verified; no fabricated lock/provenance. |
| P2 | Old rerun artifacts can coexist with fresh run-attempt evidence. | Artifact names include run ID and attempt; only exact current-attempt prefix qualifies. Old artifacts cannot satisfy missing contexts. Duplicate current contexts fail closed. Existing newest-run/rerun selection remains unchanged. |
| P2 | Hosted runner images, PostgreSQL service tags, Node/Python version selectors, Python/npm resolution and browser binaries remain moving inputs. | Explicit limitation. Node/Python installation and lock/hashes workflow edits belong to the independent dependency branch. This change does not claim fully reproducible builds or SLSA publisher attestation. |
| P3 | Windows PowerShell local execution is blocked by host policy. | Not bypassed. Both required hosted Windows shells remain required. Local verification uses supplied Pester 4.10.1 with pwsh. |

## RED to GREEN evidence

The first new Node test failed against the baseline because action ref `v4` was not a 40-character SHA. After pinning and verified Pester installation it passed. Focused Node contracts: 6 tests passed, 0 failed/skipped/todo (ci-coverage and ci-provenance). Direct generator fixtures verify wrong source rejection, missing/uncommitted lock unqualified state, correct committed lock digest, and disk/CRLF lock mutation rejection.

Local pwsh Pester 4.10.1: 46 passed, 0 failed/skipped/pending. Fixtures retain all prior workflow job, rerun, exact source worktree, custom Root, and rollback tests. New negative cases cover wrong SHA/lock/repository/workflow/run/attempt/context, missing/duplicate context, unqualified manifests, absent digest/expired artifacts, metadata mismatch, and actual downloaded archive content tampering. Old-attempt artifacts coexist with current evidence successfully; stale-only evidence is rejected. Exact Git lock bytes are checked using a custom root with spaces, apostrophe and brackets; disk mutation does not alter Git-derived expected digest.

An initial local invocation used the wrong relative Pester path, causing automatic Pester 3 loading and short TEMP paths; five preexisting source path fixture failures resulted. The corrected invocation explicitly imported the supplied Pester 4.10.1 and set TEMP/TMP to the canonical existing user Temp directory; all 46 passed. This was an environment correction, not a source-validation relaxation.

## Preservation and limits

All five workflow identities and required job names are preserved: Node 22/24 x PostgreSQL 16/18 plus Full CI coverage, PDF, Browser, Validate, and Windows PowerShell/pwsh. Full suite runner and zero-skip policy are unchanged. This branch intentionally retains old npm install and Python install commands to avoid claiming dependency-branch integration.

Action commit identities were resolved read-only from the official actions GitHub repositories using git ls-remote. The Pester digest was independently calculated from the downloaded versioned Gallery package in this session. This pins the reviewed bytes; it is not independent publisher authentication or a signed upstream attestation. Artifact authenticity relies on GitHub HTTPS/API identity and immutable upload-artifact archive digests; artifacts are job-generated provenance records, not GitHub OIDC attestations. Artifact expiration/deletion, absent GitHub digests, download authorization failure, incomplete pagination, or missing lock/context all fail closed. The updater does not acquire new credentials; public artifact-download API authorization may still be required in an actual deployment environment.

GO for independently publishing and reviewing this CI hardening branch when exact-head Actions pass. NO-GO for release/deployment: missing committed lock is an intentional blocker, dependency branch integration and fresh verification are required, and no production behavior was exercised. Hosted Actions results and exact tested commit IDs are recorded below when available.
`qualified` means only that an exact committed lock identity exists and its checkout bytes match. It does not establish lock schema validity, package manifest agreement, approved dependency closure, or provenance of installed node_modules. Those dependency checks must come from the separately integrated dependency branch and fresh full-suite evidence; this branch remains NO-GO for release.
