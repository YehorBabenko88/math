# Full CI coverage implementation plan

**Goal:** require an unfiltered, zero-skip Node 22/24 × PostgreSQL 16/18 suite.
**Architecture:** preserve existing test/API contracts; replace selective CI execution with a strict full-inventory runner and a stable aggregate check. Keep independent Native PDF and Browser workflows.
**Scope:** user specification in this chat, base `1a0c26f7a3cb5f341c3ea9ad8a87009ef33c7b90`; feature branch only, synthetic databases, no production cutover, no changes to existing PRs.

- [x] Audit workflow triggers, test inventories, conditional skips, permissions and current GitHub status.
- [x] RED: pin full matrix/unconditional triggers, zero-skip runner behavior and browser retries in `tests/ci-coverage.test.mjs`.
- [x] Implement `scripts/test-full-ci.mjs`; configure existing workflows, pinned pg dependency and zero browser retries.
- [x] RED/GREEN: reject inherited Node test selectors, skipped/todo/failed/empty fixture suites; validate local disposable runtime prerequisites.
- [x] Verify full unfiltered matrix and PostgreSQL schema cleanup after concurrent success/failure.
- [x] Verify independent PDF/browser profiles, inspect final diff and record coverage gaps.
- [ ] Commit locally, publish only this feature branch if authorized access works, inspect Actions and stop before Draft PR.

Review focus: missing DB/PDF prerequisites must fail; test selectors must not silently omit cases; failed matrix cells must fail aggregation; callback failures must drop only owned schemas; source/manual-review/production gate invariants must remain unchanged.
