# Architecture and safe consolidation plan

Scope: read-only inspection of HEAD 20ede51c6e5eddbf49fde709f8af5e77a319e1c7, tree 688d9cdeb45ccc9d6657c981a514dd32635bee99. Outputs are untracked audit artifacts. No runtime/physical acceptance is asserted. Live API metadata is in pr-live.json; merge-base diffs, current base/head SHAs, pairwise overlaps and ancestry in pr-matrix.json; full tracked path inventory in tracked-inventory.json.

## Architecture

- Browser laboratory: index.html/style.css and src/*-ui.mjs; src/app.mjs initializes example sets/functions/roots; geometry, torus/PDE, implicit surfaces, cross-domain modules provide computation and adapters. Expression parsing/security and SI/scientific evidence contracts are separately tested. Browser assets use native ES modules, without a bundler dependency.
- Scientific knowledge: src/knowledge.mjs plus src/knowledge/*, adapter registry/planner/persistence/PostgreSQL modules; src/proof-kernel.mjs; research-library/providers and experiment evidence/claim/graph modules. Candidate ingestion and independent kernel verification are distinct contracts. Source provenance/reference evidence does not by itself prove mathematics.
- Book pipeline: scripts/book-ingestion*.mjs and Python PDF extractor; src/book-ingestion/pdf.mjs, worker.mjs, review.mjs, knowledge-boundary.mjs and candidate contracts. Native dependencies are artifact/hash restricted in scripts/book-ingestion-requirements.txt (CPython3.12, pypdf6.20.1, pypdfium2 5.14.0, Pillow12.3.0, reviewed Windows amd64/Linux x86_64 wheels).
- Durable queues: src/book-ingestion/queue.mjs SQLite + shared queue-contract.mjs; postgres-queue/migrations/json/codec/transfer/gate modules; cutover controller, operator sessions, backup, journal and fencing. sql/book has five migrations. This is a separate persistence boundary from the scientific knowledge store.
- Background service: src/ingestion-{worker,supervisor,service,job-postgres,job-postgres-fenced,lease-contract}.mjs; sql/001..006 maintain adapter snapshots, jobs, fencing, checkpoints, service protocol and lease clock.
- AI coordination: src/ai-orchestrator/* and docs/AI_CODEX_ORCHESTRATOR_MVP.md; policy, plan, artifacts, receipts, claims, stream and replay contracts. Presence of the policy MVP is not authorization to execute generated commands.
- Windows tooling: scripts/windows-{bootstrap,deployment,update,q01-lab}.ps1, Q01 laboratory scripts, provenance/source identity/SQL/dependency verifiers. These are operator tooling, not proof of machine commissioning.
- Dependencies: package.json is ESM/private version0.1.0; only @playwright/test1.56.1 and pg8.16.3 declared as devDependencies; npm test expands tests/*.test.mjs, npm run test:e2e invokes Playwright. node:sqlite requires supported Node runtime (CI22/24). Runtime PostgreSQL consumers import pg despite its devDependency classification; omit-dev installation is not an established supported service deployment.
- Documentation: 44 tracked docs plus root audit/remediation reports. Key entrypoints: docs/book-ingestion-integration-gate.md, book-postgres-backend-runbook.md, q01-architecture-audit.md, qa-independent-acceptance-contract.md, proof-kernel-mvp.md, windows-local-deployment.md. Reports describe distinct historical baselines; do not conflate their evidence with this HEAD.

## Test and CI map

127 tracked test paths (includes fixtures/specs/PowerShell; not 127 independent Node suites), 88 src paths, 25 scripts,11 SQL and9 workflows. Full paths are in tracked-inventory.json.

- ci.yml is a CI contract/provenance check: Node22 Linux, tests/ci-coverage.test.mjs only. A green job named Validate Math Universe alone is not full-suite evidence.
- postgres-integration.yml is the authoritative unfiltered Node .test.mjs runner: Linux Node22/24 x PostgreSQL16/18; CPython3.12 native PDF prerequisites; scripts/test-full-ci.mjs rejects filters, absent disposable DB, unsupported runtime and skips/todo/cancelled failures. Aggregate full-ci-coverage requires all cells success. Node runner enumerates only direct tests/*.test.mjs; browser specs and PowerShell tests are separate lanes.
- browser.yml: Node22/Linux Chromium only, Python static server, tests/browser*.spec.mjs; no Firefox/WebKit/mobile/accessibility lane established.
- book-ingestion.yml: Linux Node22/Python3.12 native PDF and ingestion/SQLite test subset.
- windows-deployment.yml: hosted windows-latest, Node22, PowerShell5.1/pwsh synthetic contracts, pinned Pester and SQL-byte checks; no physical installation or operator machine acceptance.
- q01-reliability.yml: hosted Windows/Linux x Node22/24 x quick/fault/stress; exact-head runner/evidence verifier; Windows guard lane; aggregate coverage gate. Evidence uploads include failure outcomes. It is synthetic hosted execution, not physical durability proof.
- qa-q01-diagnostic.yml: manual or path-filtered PR Linux diagnostic; cannot be assumed to run for every change. Not acceptance by its own job name.
- ai-orchestrator-policy.yml and proof-kernel-isolated.yml: isolated module regression lanes; they supplement rather than replace full suite and boundary integration tests.

## Findings and decisions

P0: none established by this inventory. This is not proof of absence.

P1 COORD-01: PR19 is not a normal merge of PR13-18 heads. It contains exact changed-path content of PR14/16/17, partial content of PR13/15/18, while their heads are not ancestors. Machine matrix records this distinction. PR13 queue-contract rejects untrusted verification markers in completed results and imported snapshots; current HEAD omits its import and both guards, and omits its queue trust-boundary regression test file. Evidence: git diff e45c14d75241a778df7b603bb8b58cdcf6304690 HEAD -- src/book-ingestion/queue-contract.mjs tests/book-ingestion-queue-trust-boundary.test.mjs. This is a concrete omitted security intent/test, not proof current downstream Knowledge Store admits forged verification. NO-GO for claiming all GPT contributions or trust-boundary checks integrated. Require explicit disposition and proof at actual publication boundary before consolidation.

P1 COORD-02: Q01 closure cannot be established by architecture/green aggregate alone. docs/q01-architecture-audit.md explicitly retains unexplained historical fresh-open failure and distinguishes orphan/busy rejection. Require current exact-head receipts, complete profiles and failure classification; no physical tests performed here. Integration/release acceptance BLOCKED in this inventory, pending independently verified current execution.

P2 COORD-03: Stacked PR base names obscure dependency completeness. PR17 targets main yet has306 head-only commits/270 changed paths; it is broad historical content rather than a small independent Knowledge Graph patch. PR19 has one head-only commit relative to test/q01-queue-reliability but50 changed paths. PR13/14/15/18 share external fix/f03-r06-independent-audit-findings baseline; PR16 uses external review/base-proof-kernel-6c969ab. Never merge all numbered PRs as independent features or re-cherry-pick content merely because head ancestry is absent.

P2 COORD-04: Coverage boundaries remain Linux-only full PostgreSQL/native PDF suite, Chromium-only UI, hosted Windows contract/queue lanes; no physical Windows installation, live provider reliability, long-running production load or physical power-loss evidence. Relevant production conclusions BLOCKED; synthetic contract scope can be evaluated separately. Runtime pg packaging with omit-dev also needs an explicit supported-install check if used operationally.

## Safe plan (not executed)

1. Freeze PR/base/head SHAs and tree from pr-matrix.json; recheck API immediately before future mutation. Keep every source PR and branch unchanged. Choose a new isolated review branch from the pinned candidate after user direction.
2. Treat PR1 then PR3->4->5->6->7->8->9->10->11->12 as the historical chain; PR2 is already an ancestor of PR3 and audit HEAD. Preserve their review records; do not reapply their changes to PR19.
3. Review external bridge baselines (F03/R06 remediation and test/q01-queue-reliability) independently; they are essential DAG nodes despite having no matching open PR number.
4. Record exact-content incorporation of PR14/16/17 in PR19. Resolve PR13 trust-boundary omissions explicitly. Compare PR15/18 Q01 changes against current queue/test semantics; select minimal nonduplicate fixes only after deterministic root-cause evidence. Current matrix overlaps identify review hotspots, not automatic merge conflicts.
5. In the future consolidation branch, run strict full disposable PostgreSQL4-cell matrix, browser lane, native PDF lane, Windows shells and complete Q0112-cell/guard/evidence verification. Require exact source binding, no skips and no privacy leaks. Keep physical Windows/production acceptance separately BLOCKED unless specifically authorized and proven.
6. Publish a review-only draft PR with an inclusion/disposition table and immutable evidence. No merge, deployment, production database access or source-PR closure is authorized by this plan.

GO: preserve/investigate pinned audit and review artifacts. NO-GO: automatic consolidation/merge, claims of complete security integration or production readiness. Runtime result matrix is owned by the parent audit; this report makes no new passing-test claim.
