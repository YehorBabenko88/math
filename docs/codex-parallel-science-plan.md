# Parallel Codex integration plan — Math Universe

Base branch: `feat/math-universe-foundation`. Each agent MUST create its own branch and PR. No direct merge, no API secrets in commits. Existing foundation: `src/research-providers.mjs`, `src/research-library.mjs`, `src/experiment-evidence.mjs`.

## Agent A — Provider connectors (priority 1)
Branch `feat/research-provider-connectors`.
Implement read-only arXiv search (Atom XML safely parsed, no external entities), Semantic Scholar Graph API, and Wikidata SPARQL read-only connector. Keep provider-specific requests behind injected fetcher; add fixture-based tests, pagination limits, timeouts, 429 retry/backoff, user-agent, caching, no arbitrary URLs/SSRF. Use DOI and arXiv IDs to deduplicate. Do not change graph UI.

## Agent B — Scientific knowledge graph
Branch `feat/scientific-knowledge-graph`.
Build versioned JSON schema and in-memory graph for Work, Author, Concept, Claim, Formula, Evidence, Experiment nodes; typed edges (cites, derives, contradicts, tests, uses_formula). Require provenance with stable IDs and exact locators; validate foreign keys, no executable text, detect cycles in derivation edges; test export/import and dedup. Work only in `src/knowledge-graph*.mjs`, `tests/knowledge-graph*.test.mjs`, and schema docs.

## Agent C — Verified adapter proposal pipeline
Branch `feat/research-adapter-proposals`.
Create offline pipeline that converts human-reviewed claims into declarative adapter proposals, NEVER executable code automatically. Require declared input/output types, units, assumptions, source locator, benchmark and failure cases. Gate code generation behind explicit human approval and PR. Tests for invalid dimensions, unsupported operators, prompt injection, malformed metadata. Work only in `src/adapter-proposal*.mjs`, tests, and docs.

## Agent D — Reference books
Use `docs/codex-reference-extraction-task.md`; receive the two user-provided scanned PDF books separately, inspect exact rendered pages, no blind OCR. Build only small verified citation catalogs, no copyright-heavy full text.

## Agent E — Browser research explorer
Branch `feat/research-explorer-ui`.
Build offline-first browser interface for search results and evidence links; mock provider requests, accessible controls, browser E2E. Never expose API keys client-side. Coordinate with main maintainer before editing `index.html` or `src/graph-ui.mjs`.

## Review and integration
Each PR: explain scope, test results, provenance/security constraints, data licensing, API cost/rate limits, and compatibility. CI green is required, but is not scientific validation. Never automatically merge or publish third-party comments.
