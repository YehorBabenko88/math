# Unified historical scientific pipeline implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Execute both Math APIs from one immutable source and make historical research reproducible.
**Architecture:** Math #102 is the integration base; transplant the exact additive #100 history changes and verify original blobs. Grid selects operator-pinned snapshots read-only. Strattester snapshots both engines from one Math commit/tree, delegates computation, binds decision-time provenance and retains its OOS accounting.
**Tech Stack:** Python stdlib, Node ES modules, PostgreSQL read-only reader, GitHub Actions.
**Spec:** User-approved single-revision integration and original eight requirements in this chat.

## Global constraints
No PR merge, deployment, production PostgreSQL access or trades. All new PRs draft.
No clock substitution. No numerical kernels in Grid. Receipts do not authenticate sources.

## Review focus
Delayed availability must be accepted only by decision time.
External graph sources cannot bypass historical provenance.
Changing a future suffix cannot change an earlier decision result.
A Math checkout with either engine missing, wrong revision or dirty bytes must fail closed.
Snapshot identity cannot silently select another market or revision.

### Task 1: Restore importable Strattester handoff
- [ ] Reproduce existing import failure and add compile regression covering the handoff module and test.
- [ ] Replace only accidental literal newline escapes; rerun compile regression.
- [ ] Run handoff tests with exact history producer references; record outcome.

### Task 2: One Math source and joint contract
- [ ] Apply additive #100 commits on own #102 branch and assert original historical kernel blob parity.
- [ ] Add failing delayed-availability scientific behavior test; fix as-of admission; preserve old parity.
- [ ] Add failing history scientific bridge tests: actual clocks, multi-model/formula/comparison, injected source rejection, stale/incomplete/delayed/lookahead and source mismatch.
- [ ] Implement bounded Python joint worker calling committed Node engine; expose no training/trading authority.
- [ ] Run historical tests, bounded scientific contracts, and complete project command; record unrelated failures explicitly.

### Task 3: Grid immutable snapshot selection
- [ ] Test operator-pinned market/range/revision selection against duplicate revisions and mismatches.
- [ ] Add bounded snapshot selector using existing repeatable-read reader; preserve dataset and request fingerprints.
- [ ] Add negative and disposable PostgreSQL coverage; run exact-head CI.

### Task 4: Strattester joint client and integration
- [ ] Test one-source pin enforcement, historical-to-scientific execution, suffix invariance and negative cases.
- [ ] Extend immutable Math snapshot client for bounded joint worker and node runtime pin; preserve historical path.
- [ ] Pin new Grid/Math commit/tree; run existing replay/OOS/financial regression tests and joint composition tests.
- [ ] Add Windows/Linux exact-head workflow checks, receipts and full source manifests.

### Task 5: Publication and independent review
- [ ] Commit, push own branches and create draft PRs targeting approved bases.
- [ ] Review whole diff, resolve actionable findings with RED/GREEN.
- [ ] Observe exact-head CI to terminal state; hash evidence and artifacts; report unresolved admission conditions.
