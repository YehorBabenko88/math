# Book / PostgreSQL integration audit plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent scoped tasks and tests before implementation.

**Goal:** audit the merged Book pipeline and fenced PostgreSQL queue without replacing either store or enabling unattended ingestion.

**Architecture:** Preserve both input histories through merge f60cbe6. Retain the existing Book queue API and legacy PostgreSQL API. Add a documented, validated common lease representation, SQLite lease renewal, and opt-in fenced PostgreSQL checkpoints. Full Book-store substitution stays fail-closed because identity mapping, review persistence, snapshots and migration are separate obligations.

**Tech stack:** Node 22/24, SQLite, PostgreSQL 18 local disposable cluster if supported, pinned native Python PDF runtime, Playwright Chromium.

**Spec:** user request 2026-10-16; docs/codex-book-knowledge-pipeline.md; docs/book-ingestion-integration-gate.md.

## Constraints and review focus

- Only feat/book-postgres-integration-test changes. Source branches/main and Cluster Grid remain untouched; no push or system permission changes.
- Tokens are opaque acquisition identities, not reusable worker names. Renew/checkpoint/complete/fail reject stale tokens and expired leases.
- Claim resumes the last committed checkpoint. Provenance and source/review policies remain intact. Queue completion never implies scientific approval.
- Migrations are explicit, additive, advisory-locked, transactional and idempotent; old callers keep supported APIs.
- PostgreSQL tests use private schemas in a dedicated disposable database so test processes cannot claim one another's jobs.
- All source material is untrusted; no commands/formulas from books execute as code and no external AI calls are enabled.

## Tasks

- [x] Fetch exact review input, create isolated branch, perform normal merge preserving both parents; baseline 196 tests, 192 pass, 4 optional skips.
- [x] Add portable lease contract, normalize actual SQLite token and PostgreSQL claim_token; fenced SQLite renewal and regressions.
- [x] Add PostgreSQL checkpoint migration/API and exact-expiry/retry fencing regressions; keep legacy API isolated.
- [x] Isolate PostgreSQL live tests; test same-worker reclaim, stale operations, committed checkpoint after killed worker, migration concurrency/rollback and backward compatibility.
- [x] Audit merged source/external-provider/human-review boundaries; add integration regressions without graph auto-import.
- [x] Run Node22/24 (238/238 each), real native PDF, disposable PostgreSQL (5/5 per process, two processes) and browser tests (14/14); independent review complete.
- [x] Record local implementation commits and prepare final report/artifacts with HEAD and safe PowerShell publication command; never execute push. Final metadata lives in outputs/book-postgres-integration-report.md, outside the source repository.
