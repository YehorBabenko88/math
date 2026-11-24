# Book Knowledge Ingestion implementation

Base: feat/math-universe-foundation, d5f725f. Binding requirements:
docs/codex-book-knowledge-pipeline.md. User authorizes autonomous implementation.

Only new src/book-ingestion/*, scripts/book-ingestion*, tests/book-ingestion*
and dedicated docs/schema/fixtures are modified. Existing intake/planner,
execution/scientific graph internals, UI/server and workflows are read-only.
No Cluster Grid, unattended processing or external uploads.

1. Durable queue: built-in Node SQLite with transactional durable writes;
   idempotency SHA256(file+edition+page+extractionVersion); expiring fenced
   leases, bounded retries, recovery and JSON snapshot backup/restore. Async
   repository API portable to PostgreSQL; local filesystem only, Node >=22.13.
2. Candidate contract: knowledge-candidate/v1 source hash+edition+version+license,
   1-based PDF page and optional printed page, region and extraction-quality
   metadata. Strict bounded JSON, inert AST, symbols/units, claims/concepts,
   cross references, independent numerical examples and uncertainty. Human
   review is separate trusted data; approval checks source, never theorem truth.
3. PDF boundary: trusted local parser subprocess with fixed executable/script,
   argument arrays, deadlines/output caps and page bounds; SHA256 bytes verified
   before and after extraction. Page images/OCR are separately injected local
   interfaces; scans/low quality cannot pass review without visual attestation.
   No shell interpretation or network; Python parser deployment must be
   sandboxed by the host for strong filesystem/memory/network containment.
4. Codex adapter: local fixture/callback and separately authorized external
   transport. Source text is a distinct untrusted JSON data field. Responses
   are schema-verified, source-pinned and deterministically verified.
5. Worker: one explicitly invoked leased job, checkpoints, redacted metrics and
   candidate persistence. Review CLI read-only by default, explicit decisions.
   Reviewed graph patch/transaction adapter with import-once repository contract.
6. Test-first cycles; full existing suite after each component. Synthetic PDFs
   only. Security cases: injected instructions, executable/unsafe AST, corrupt
   PDFs, unit/result mismatch, wrong page/hash/version, unauthorized excerpts,
   duplicate imports, stale leases, restart and interrupted persistence.

Review focus: process interruption vs atomic commit, accessor/JSON bombs, stale
lease fencing, page/hash swaps and forged AI review/status fields.
