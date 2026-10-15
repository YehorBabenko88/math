# Book ingestion integration gate — 2026-10-15

## Inputs and baseline
- Baseline: `feat/math-universe-foundation` at `18e50d855bd3be4bc50da8062f346b8026d01655`.
- Codex deliverables received separately: `book-ingestion.bundle`, `book-ingestion.patch`, `book-ingestion-source.zip`. Bundle head `5eee980951fc33f3fd0396250f24e52b350fd1aa`.
- The source ZIP is a complete tree snapshot; do **not** apply the patch over the ZIP because its 25 added paths already exist there.
- Locally exercised `node --test tests/book-ingestion-*.test.mjs`: 54 tests, 53 pass, 1 skipped, 0 failures. This is not a GitHub Actions test of the Codex commits.

## Architectural boundary
- Keep `src/book-ingestion/queue.mjs` as the bounded local SQLite queue; it uses a per-claim fencing token, checkpointing and explicit review.
- Existing `src/ingestion-job-postgres.mjs` is a separate distributed queue with worker ID/lease semantics; it does not implement the SQLite fencing-token contract. Do not alias these stores or silently route SQLite jobs into PostgreSQL.
- Keep approval explicit. Graph patches must not be auto-applied based on extraction, Codex response or numerical examples alone.
- Keep PDF parsing local by default; external transport requires explicit authorization and bounded excerpts.

## Integration stages (not yet completed)
1. Transfer the 25 additive files from the verified Codex artifact into **this review branch**, preserving bytes and paths. Do not replace existing baseline files.
2. Verify the imported tree against the Codex ZIP and run all Node tests on Node 22 and 24.
3. Run native PDF tests with isolated pinned Python dependencies, and audit PDF parser sandboxing on Windows.
4. Add a CI job for the book-ingestion tests; keep the external Codex transport disabled in CI.
5. Review SQLite/PG adapter interfaces separately, including claim-token fencing, lease expiry, retries and checkpoint atomicity.
6. Open a PR into `feat/math-universe-foundation` only after all checks pass; no automatic merge.

## Risk register
- **High:** cross-queue lease semantics mismatch can permit stale completion without a fencing token.
- **High:** untrusted PDFs require OS-level isolation, not merely parser validation.
- **Medium:** local tests cannot establish Windows service restart safety or real-book extraction quality.
- **Medium:** provenance and reviewer identity must remain authenticated by the host application.
