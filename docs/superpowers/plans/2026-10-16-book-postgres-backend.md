# Book PostgreSQL Backend Implementation Plan

> Use subagent-driven-development for independent schema/backend/migration work;
> parent owns shared contract extraction and integration verification.

**Goal:** Explicit Book PostgreSQL queue and reversible pre-switch migration.
**Architecture:** Reuse SQLite pure transitions and logical snapshot contract;
dedicated relational persistence and migration ledger; no automatic switch.
**Spec:** `docs/book-postgres-backend-design.md`.
**Stack:** Node 22/24, node:sqlite, pg, PostgreSQL, existing native PDF/Playwright.

## Steps

- [ ] Test then extract shared Book validation/transition contract; existing SQLite regressions unchanged.
- [ ] Test then add separate Book schema runner with constraints/idempotence/concurrency.
- [ ] Test then implement PostgreSQL transaction adapter with every native Book method and ID mapping.
- [ ] Test then implement hashed migration plan/dry-run/apply/verify/pre-switch rollback and explicit compatibility gate.
- [ ] Cross-review security, provenance/review semantics, interruption/idempotence and corrupted snapshots.
- [ ] Full Node22/24 with PDF and live PostgreSQL; parallel database tests; Browser E2E.
- [ ] Local commits, clean worktree, bundle and report with exact separate push command.

## Review focus

Partial SQL failure must leave no imported subset; retry must not overwrite
different payloads. Restore must invalidate active tokens and retain attempts.
Receipts must not approve an altered candidate or create proven claims. Operator
confirmation must bind current target state, not stale dry-run data. Rollback must
not remove work changed after import. Every ID/hash is checked before any write.
