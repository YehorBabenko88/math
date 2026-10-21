# CI and release provenance report

Scope: independent branch `fix/ci-release-provenance`, baseline `8dd1186f3fc34fa0148eb137cb44fc2416321e7c`. Historical SQL is unchanged. No deployment, service operation, production database operation, merge, or settings change was performed.

## Findings and disposition

| Priority | Finding | Disposition |
|---|---|---|
| P1 | Audit gap: trusted exact-source checks had no downloaded source/dependency provenance archive verification. No critical production bypass was demonstrated. | Release gate now requires current-attempt provenance archives, verifies downloaded ZIP bytes against GitHub SHA256 metadata, and binds bounded manifest contents to exact source SHA, committed lock SHA256, repository, workflow path, run ID, attempt, and each producing job context. |
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

No P0 finding was demonstrated in this bounded audit.

## Tool and download inventory

Audited all five .github/workflows/*.yml files and scripts for external Actions, download commands and tool installers. Immutable Actions cover checkout, setup-node, setup-python and upload-artifact. The sole direct framework package download is now the verified Pester Gallery archive. npm, pip and Playwright Chromium/OS-dependency installation remain the coordinated dependency-branch/infrastructure boundary. PostgreSQL service images still select major-version tags. windows-bootstrap.ps1 selects Git, Node LTS and NSSM via the winget catalog; it was inspected but not executed or changed. Hosted Ubuntu/Windows images, Git/PowerShell runtimes, winget catalog provenance and service binaries are not attested by these source manifests. Existing explicit bootstrap package consent remains intact.

## Published implementation evidence

Initial implementation SHA: e5e0d4b5868cd771cd77a3ea1cb2783414c271bc. All five first-head hosted runs succeeded without reruns:

- [Validate Math Universe](https://github.com/YehorBabenko88/math/actions/runs/39383476848)
- [Browser E2E](https://github.com/YehorBabenko88/math/actions/runs/39383476838)
- [Book Ingestion Native PDF](https://github.com/YehorBabenko88/math/actions/runs/39383476856)
- [PostgreSQL Integration, all four cells and aggregate](https://github.com/YehorBabenko88/math/actions/runs/39383476854)
- [Windows Deployment Contracts, both shells](https://github.com/YehorBabenko88/math/actions/runs/39383476828)

A real Validate artifact (ID 12245899722, 346 downloaded bytes) was downloaded through the authorized GitHub CLI. Actual archive SHA256 8d112698839a695f7cdaec13390e0f31ca712473f8bfaabe0162525517353f70 exactly matched the GitHub API digest. Its manifest contained this exact source SHA, run ID 39383476848, attempt 1 and test context, with honest qualified=false and null lock digest. Local Browser verification on assigned port 4185 passed all 14 tests without retries.

Final implementation working tree local verification (before this report-only evidence update): Node 22/PG16, Node 22/PG18, Node 24/PG16 and Node 24/PG18 each passed 411 tests with zero failures, cancellations, skips or todo. Full runner reported all 399 top-level inventory tests plus nested tests (411 total); no exclusions or retries. Disposable parent-managed PostgreSQL ports 55440/55439, database math_universe_test, were used under the assigned slot; no server lifecycle or production target was touched. Logs: outputs/ci-provenance-node22-pg16.log, outputs/ci-provenance-node22-pg18.log, outputs/ci-provenance-node24-pg16.log and outputs/ci-provenance-node24-pg18.log in the parent workspace. Dependencies were copied once from the explicitly authorized sibling node_modules; this does not establish dependency reproducibility.

After first-head publication, final changes additionally reject non-Boolean qualified/expired metadata and invalid/nonpositive/oversized artifact metadata. Final local pwsh/Pester verification still passed 46/46 and Node 22 focused contracts 6/6. The completion message provides the final published commit SHA and its fresh hosted run URLs; this report intentionally does not embed its own circular commit hash.
