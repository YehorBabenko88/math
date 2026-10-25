# PR31 boundary audit

Target: cb168925b5aeec0c957137dd94ab72c64f0bd333; tree 10cfd29f5d2c75e841d88dd70bef8773dada8287. Read-only source audit plus selected Node tests, 2026-10-25. No source edits or defect fix PR.

## Results

| Scope | Result | Evidence / limit |
|---|---|---|
| Merged 34-file preservation vs nine selected source heads | PASS | Every changed file blob exactly matches at least one selected source head. See merged34-source-blob-comparison.tsv. This is composition evidence, not correctness evidence. |
| Candidate graph/storage | PASS | createCandidate/createEdge snapshot descriptors and reject proxies before traps, accessors, hidden and symbol fields; immutable retained primitive statements/provenance. Store dependency cloning preserves API shape and defensive copies. Tests knowledge-candidate/store. |
| Authenticated result boundaries | PASS | inertRecord rejects active/nonprimitive records before binding/authentication; frozen snapshot passed to callback; exact theorem/proof/content/context and kernel identity checked; Ed25519 canonical signature checked. v2 validates before persistent consume and returns AUTHENTICATED_RESULT_ONLY. Signature success grants no graph status. |
| Proof JSON ingress | PASS | Both proof and expected-goal strings are checked as text and <=262144 UTF8 bytes before parse; canonical JSON and exact requested goal retained; closed theorem gate rejects top-level hypotheses. |
| Source identity | PASS | lowercase exact 40/64 hex Git shapes accepted without conversion; content/image/toolchain/receipt digests remain 64 hex. Cross-format identity mismatches rejected; shape is not repository existence or attestation. |
| No VERIFIED promotion | PASS, scoped static/tests | Book knowledge assessKnowledge rejects KERNEL_VERIFIED; graph always CANDIDATE/null verification; kernel assessments remain AUTHENTICATED_RESULT_ONLY; experimental checker scoped CHECKED_IN_EXPERIMENTAL_KERNEL; AI inspect explicitly proof NOT_VERIFIED/publication DENIED. |
| Focused Node 24.20.0 | PASS with NOT_RUN cases | 167 enumerated, 164 passed, 0 failed, 3 skipped; node24-tests.log. |
| Focused Node 22.23.3 | PASS with NOT_RUN cases | 167 enumerated, 164 passed, 0 failed, 3 skipped; node22-tests.log. |
| Local symlink-directory guard test | NOT_RUN | knowledge-ledger-directory: ledger rejects symlink directory; symlink privilege unavailable, both runtimes. |
| Local POSIX directory mode guard test | NOT_RUN | knowledge-ledger-directory: ledger rejects group-writable directory on POSIX; Windows lacks POSIX mode semantics, both runtimes. |
| Local symlink ancestor guard test | NOT_RUN | knowledge-ledger-directory: ledger rejects a symlinked ancestor even when leaf is a directory; symlink privilege unavailable, both runtimes. |
| Queue/native containment/physical hosts/live PG/deployment | NOT_RUN | Explicit delegated scope excludes these executions. No queue, native backend, physical host, PG service or deployment invoked. |
| Production / Q01 acceptance | BLOCKED | Q01 remains OPEN; focused test success cannot clear physical or production NO-GO. |

## Cross-module contracts and limits

The arrows BookIngestion -> legacy/KG -> ProofKernel -> AIOrch describe separate boundaries, not an implemented automatic verified-publication pipeline. src/book-ingestion/worker.mjs:39 completes a job with stage review_required after verifyPageCandidate. src/book-ingestion/codex.mjs:25 verifies extraction/source/page pins, not a mathematical theorem. src/book-knowledge-intake.mjs:17 allows human approved review but has no proof or kernel import; its sourceHash is bounded text rather than a cryptographic verifier. src/knowledge.mjs is the static curated starter graph. These legacy records cannot be treated as authenticated KG revisions without a separate reviewed conversion.

KG buildVerificationRequest (src/knowledge/verification-request.mjs:3) requires theorem/proof CANDIDATE targets and sha256-prefixed revision/content/context hashes. Legacy unprefixed ingestion hash64hex / AI bare SHA256 must not be passed blindly. No new automatic conversion or connection is introduced in PR31. assessKernelResult (src/knowledge/kernel-result-boundary.mjs:6) and OneShotKernelVerifier.assessPersisted (src/knowledge/one-shot-verifier.mjs:22) authenticate bound result envelopes; neither invokes the experimental implication proof checker or changes CandidateGraph. v1 assessment has no replay ledger; v2 binds request_id and consumes a FileReplayLedger entry. Persistent replay tests run locally with temporary files; their success does not establish power-loss durability, shared-host safety or Windows ACL confinement.

src/proof-kernel.mjs:109 validates an expected closed propositional implication theorem; its finite calculus is not general mathematics verification. src/ai-orchestrator/inspect.mjs:6 checks receipt/output bytes, execution-claim correlation and replay state but explicitly returns NOT_VERIFIED and DENIED at line 13. Its identity evidence remains UNATTESTED_CLAIM. No newly added import crosses these authority boundaries. Active JavaScript objects in AI/legacy APIs remain outside the specific inert kernel/KG hardening contract; these helpers are not a sandbox for executable in-process adversaries.

No confirmed new defect was found in the focused changes. No RED/fix worktree was warranted. This conclusion is bounded to reviewed changes and the listed test set, not full API/security/scientific acceptance.

## Reproduction

Test list is test-files.txt: knowledge*.test.mjs and ai-orchestrator*.test.mjs excluding registry tests (SQLite), plus proof-kernel, book-ingestion-knowledge-boundary, book-knowledge-intake. PostgreSQL adapter tests in this selection use mocked query interfaces, no database connection. Run node --test with those path arguments. Logs retain exact pass/skip identities. Source head comparisons use git rev-parse <head>:<path> blob IDs versus the exact target commit; all 34 rows have a matching source head.
