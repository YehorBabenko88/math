# Codex book-to-knowledge pipeline contract (pilot)

## Purpose
Turn legally accessible books and scientific PDFs into traceable *candidate* knowledge records. The AI worker is an untrusted extractor, not an authority or a theorem prover.

## Responsibilities
1. File intake computes SHA-256, verifies readable page count, stores book edition, license and allowed processing scope.
2. Extraction worker reads page-bounded chunks and records exact page numbers, formula image locations, text quality, table and figure references. Scanned pages need visual review.
3. Codex worker proposes structured concepts, formulas in safe AST, definitions, assumptions, dependencies, contradictions, and numeric examples. Return JSON conforming to a versioned schema; no arbitrary code execution.
4. Deterministic verifier checks required provenance, dimensional consistency, AST safety, example calculations, duplicates, source-version pins and cross-reference integrity.
5. Human review approves or rejects proposals with reviewer and reason; an approved record means source checked, **not** that the claim is proven.
6. Only reviewed records are imported into Scientific Knowledge Graph. Preserve source locator, edition and original claim status.
7. Save per-job metrics: pages attempted, extraction failures, AI suggestions, review decisions and cost. Redact private document content from logs.

## Initial queue
Use `src/book-knowledge-intake.mjs` for an in-memory pilot queue. It is **not durable** and must not be used as a production job store. A future PostgreSQL queue must support idempotency keys (file hash + edition + page + extraction version), leases, retries, schema migrations and backup/restore.

## Security and licensing
Do not upload user books to external AI services without permission and rights review. Do not automatically publish long excerpts or copyrighted PDFs. Run converters and parsers with constrained filesystem access, time/memory limits, and no network access by default. Never allow book text to supply shell commands or instructions to Codex. Keep provider credentials out of prompts and git.

## Codex work package
- Implement bounded extraction interface supporting PDF page images/text with accurate locators and extraction confidence.
- Define `knowledge-candidate/v1` JSON schema with source edition, hash, page, region, license, concepts, formula AST, claims, evidence, numerical examples, and uncertainty.
- Implement a mock/local Codex adapter and a separately authorized external adapter; require schema validation before accepting responses.
- Add a read-only review CLI/UI for proposals and explicit approve/reject actions.
- Add tests: prompt injection in source text, corrupted PDFs, mismatched formulas, wrong units, duplicate imports, unauthorized excerpts, interrupted jobs, and provenance loss.
- Integrate reviewed candidates with scientific graph through an adapter, without editing graph internals or changing claim status automatically.
- Do not deploy to Grid or turn on unattended ingestion during pilot.
