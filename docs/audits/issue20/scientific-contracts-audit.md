# Independent scientific boundary / cross-module audit

Audited HEAD: `20ede51c6e5eddbf49fde709f8af5e77a319e1c7`; comparison base: `0276aa046265c945d79a88b5be1b0b9ea5cd0950`. Runtime used: Node v24.20.0, Windows; these local pure-JavaScript results are not physical-host commissioning or scientific acceptance. Audit source checkout remains unchanged except output artifacts. No external AI, PDFs, network services, publication, deployment, credentials, push or merge used.

Scope: read all changed source modules in proof-kernel, book-ingestion/knowledge-boundary, knowledge and ai-orchestrator; read QA manifest implementation, isolated workflows and relevant source tests. Existing registry/ledger filesystem tests and Q01/integration/physical-host tests were NOT_RUN in this subtask. This report complements, rather than substitutes for, the parent audit's queue, privacy, and provenance findings.

## Findings at the audited HEAD

### P2 R1 — populated dependency queries always throw

`src/knowledge/candidate-store.mjs:40-42`: `dependencies()` passes `structuredClone` directly as the Array.map callback. Array.map supplies `(value,index,array)` and index is interpreted as structuredClone's options dictionary. On Node24.20.0 every nonempty outgoing dependency query throws `ERR_INVALID_ARG_TYPE`. Empty queries happen to work, which is the only dependencies case covered by the existing cycle test. This breaks graph traversal for real dependent candidates; it does not promote any candidate to VERIFIED.

Evidence: `contract-observations.test.mjs` R1; real expected-behavior regression RED in `dependency-red.txt` (5 pass, 1 fail with TypeError), followed by authorized minimal fix in a separate worktree, below.

### P2 R2 — source commit identity conflicts with this repository's Git identity

`src/ai-orchestrator/policy.mjs:5,11`, `receipts.mjs:3,9`, `claims.mjs:4,11` require sourceCommit to be 64 hexadecimal characters, sharing the SHA256 artifact regex. Actual audited Git SHA is 40 characters, QA `scripts/qa-evidence-manifest.mjs:7` requires 40, and `docs/AI_CODEX_ORCHESTRATOR_MVP.md:3,11,54` calls this field a pinned source commit and discusses 40-character commits. An exact audited Git SHA is rejected; a fabricated 64-character string is accepted structurally. No source resolver establishes that the 64 characters identify repository content.

The code technically permits a future SHA256 Git repository or an external content digest; neither alternate meaning is defined or mapped here. This is therefore a concrete current cross-module identity contract mismatch, not proof that all 64-character object identities are inherently invalid. Do not fix by padding/hashing a Git SHA without an explicit algorithm-tagged contract. No fix made.

Evidence: `contract-observations.test.mjs` R2; every selected orchestrator fixture uses repeated 64-character strings and misses the repository's exact SHA.

### P2 R3 — candidate graph admits malformed provenance via mutable accessors

`src/knowledge/candidate-graph.mjs:30-35` validates source_hash then reads it again when constructing retained provenance. `keysOnly()` checks enumerable names/prototype, but does not reject accessor properties or proxies. An enumerable source_hash getter returning a valid digest on its first read and `not-a-digest` on its second yields a valid-looking CANDIDATE with malformed retained provenance. The same repeated-read pattern applies to statement and kind fields. An authorized adapter in the same JS process can invoke this directly; ordinary JSON input does not carry getters. No status escalation demonstrated, and this is not an execution claim about remotely supplied JSON.

Evidence: `contract-observations.test.mjs` R3 returns `provenance.source_hash === 'not-a-digest'`. The OCR boundary rejects getters/proxies explicitly; the graph boundary does not share that contract. No fix made.

## Scientific boundary observations

No P0/P1 unsafe VERIFIED/proven promotion was demonstrated in the read modules. This is a bounded source/test conclusion, not a general mathematical soundness proof.

- GPT1: proof kernel implements only atom and implication syntax, assumption, implication introduction and elimination. There is no calculus, arithmetic, quantification, execution of generated formulas, or general theorem prover. Accepted results identify `experimental-propositional-implication/v1`; conditional contexts report openAssumptions and closed-gate APIs reject them. Expected-goal checking binds the exact canonical goal string. Existing Boolean truth-table smoke tests give bounded independent checks, not full kernel correctness.
- GPT2: assessKnowledge refuses KERNEL_VERIFIED and returns mathematicallyVerified:false for accepted nonverified states; rejectUntrustedVerification rejects its declared verified claim keys recursively, including hidden/accessor/proxy structures. This library's presence alone does not prove every book/LLM consumer calls it.
- GPT3: graph store creates CANDIDATE only, defensively copies history/getRevision and keeps conflicts UNRESOLVED. Result authenticators return AUTHENTICATED_RESULT_ONLY. They authenticate a signature/binding, not the mathematical truth, source OCR fidelity, or kernel implementation. The v1 authenticator is replayable; the v2 one-shot path uses a persistent ledger. Neither path grants VERIFIED or publishes.
- GPT5: inspectOfflineEvidence returns proof:NOT_VERIFIED and publication:DENIED; metadata PASS, integrity MATCHED, REGISTERED_UNATTESTED and UNATTESTED_CLAIM are not scientific verification. Registry is standalone and replay filters are caller-controlled offline simulations; real execution, enforcement and publication remain absent.
- GPT6: manifest binds evidence bytes and declared source/run/job to trusted expected context. It does not itself establish JUnit completeness, privacy, successful test execution, independent runner origin, kernel correctness, or physical production acceptance. Parent QA audit owns those gates.

## Proposed independent acceptance contracts

1. Define an algorithm-tagged repository identity separate from artifact SHA256; all task/receipt/claim/QA records must bind the exact immutable commit plus tree. Negative-test wrong commit, same-length invented commit, wrong repository, and replay from another run.
2. One inert JSON/data boundary for OCR -> graph -> verifier. Snapshot validated own enumerable data descriptors once; reject getters, proxies, sparse arrays, hidden/symbol fields, cycles and noncanonical numbers. Assert retained provenance exactly equals validated source hash/edition/page/extraction identity.
3. Bind any future scientific certificate to exact theorem, proof, context, calculus/version, kernel build identity, source edition/page/extraction digest and a trusted request issuance record. Reject unsupported calculus rather than coercing it into implication atoms. Closed-theorem publication must require zero open assumptions independently of a PASS signature.
4. Keep authenticated evidence, formal checking, human source review and publication as separate typed outcomes. No enum/boolean rewrite from self-reported PASS, LLM/source review, ADAPTER_TESTED or signature authenticity into VERIFIED.
5. A durable one-shot contract needs restart, concurrent process, replaced-directory, access-denial and crash/fault evidence. FileReplayLedger syncs its marker (`file-replay-ledger.mjs:36`) but does not sync the directory; power-loss durability cannot be claimed from this local pure suite. Windows ACL/reparse/physical-host and crash semantics remain NOT_RUN.
6. Replay/lease/task identifiers need issuance ownership and atomic registration in the trusted service before execution; immutable in-memory plan/filter transformations do not constitute cross-process compare-and-swap or authenticated fencing.
7. Scientific QA should independently recompute proof/goal binding and full JUnit identities, fail on missing/skipped required cases, scan output privacy, and retain exact source/tree/run/job provenance without treating hosted/synthetic success as production proof.
8. Expected-goal proof JSON wrapper parses proof text before its delegated 256KiB size gate (`proof-kernel.mjs:114,118`). Enforce transport byte limits before calling any parser and test all public entrypoints consistently. Resource exhaustion/fault injection NOT_RUN.

## Executed validation and remediation

At audited HEAD: selected 15 pure source test files, **129 PASS / 0 FAIL / 0 skipped**; output `existing-tests.txt`. Three standalone observational repros, **3 PASS**, in `contract-observations.txt`; PASS here means the defect observation was reproduced, not that its contract is correct.

Authorized follow-up isolated fix:

- Branch: `fix/knowledge-dependency-clone-20`.
- Worktree: `work/math-knowledge-dependency-clone-20`.
- Commit: `78d546ba257efe809e91e85179d2faad3499adf5`.
- Tree: `8f15e641a612234dc1c22f27cea7c0e6f53ad176`.
- Minimal source change: wrap structuredClone in a unary callback.
- Added regression queries two outgoing dependencies, excludes other relation types and incoming edges, checks defensive copies, empty results and unknown IDs. Regression failed against original source before the fix, then the selected pure suite **130 PASS / 0 FAIL / 0 skipped**, output `dependency-green.txt`.
- `git diff --check`: PASS; local commit worktree clean after commit. No push performed. Native worktree creation returned Not a git repository, so manual git worktree fallback created the explicitly requested branch from exact audited HEAD.

NOT_RUN: full npm test (includes service/integration behavior outside this scoped no-service task), Node22, hosted CI, Q01 stress, external service tests, end-to-end OCR/LLM/graph/kernel/publication, ledger fault injection, physical Windows acceptance. Existing pure green tests do not close those gates.

## R3 isolated follow-up remediation

Root authorized a second independent branch from exact original `20ede51c6e5eddbf49fde709f8af5e77a319e1c7`; it contains no merge or cherry-pick of the dependency fix.

- Branch: `fix/knowledge-inert-input-20`.
- Worktree: `work/math-knowledge-inert-input-20`.
- Local commit: `fe4bb544d62d65bc47701f843ccff233462bac57`.
- Tree: `6827a4350145427abd186ca52af0f98afe3896b8`.
- Change: `candidate-graph.mjs` snapshots own enumerable data descriptors for each known record (candidate root, statement, provenance, edge). It rejects proxies before any prototype/property inspection, accessor fields before reading values, hidden fields and symbols. Snapshot records are validated and retained using the existing schema/hash/status logic; ordinary plain JSON candidate and edge APIs remain intact. No new graph architecture or authority introduced.
- RED: five added regression tests all fail against original source (9 pass / 5 fail), `inert-input-red.txt`. Tests cover mutable source_hash getter, root/statement/provenance proxies, accessor fields at each boundary, hidden/symbol fields and edge getter/proxy inputs, with zero getter/trap invocations required.
- GREEN: all existing pure knowledge graph/request/authenticator/result tests, proof kernel and book knowledge boundary plus the regressions: **65 pass / 0 fail / 0 skipped**, `inert-input-green.txt`.
- `git diff --check`: PASS; worktree clean after local commit; no push. Existing filesystem ledger/one-shot/persisted verifier tests, services, full npm test, Node22, hosted CI and physical/fault injection remain NOT_RUN in this subtask. SourceCommit contract mismatch remains documented and unchanged.
