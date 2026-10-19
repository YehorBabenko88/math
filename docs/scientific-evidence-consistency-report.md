# Scientific evidence consistency: R07 / R08

Scope: isolated `fix/scientific-evidence-consistency`, based directly on `740f35742aa585f67471edea2fab5f5205a321f6`. The integration audit at `22c0b51` was read only. No A/B remediation, production gate, workflow, database implementation or integration changes are included.

## Changes and reproducible regressions

R07: `src/expression.mjs` now uses primary → power → unary → product precedence, with a unary exponent operand. This matches `compileImplicit`: `-x^2=-4`, `(-x)^2=4`, `x^-2=0.25`, `x^2^3=256` at x=2. Tests also check negative powers, unary minus before negative powers and parenthesized exponents. Both parsers remain restricted grammars; no eval or arbitrary execution was introduced.

R08: the chosen correction explicitly separates independent citation examples rather than implementing a node-output verifier. `validateGraphNodeEvidence` still checks that the node exists and executes, but now returns `relationship: 'independent-citation-examples'`, `nodeOutputValidated: false`, and `citationExamples`. **Observable API change:** the old `.evidence` property has been removed. Callers must use `.citationExamples` only for independent source examples and MUST NOT interpret its status as validation of graph output, samples, units or parameters. No top-level scientific status is returned. `referenceId` and `locator` remain in the examples result. No source-version contract was added to the underlying validator.

The regression explicitly exercises graph output [999,999] with unrelated expected=actual=1 m/s, verifies that no node-bound evidence/status is returned, and checks that changed graph values still cannot imply node validation. The existing independent 36 km/h = 10 m/s example remains valid and is transparently labeled. Contradicted examples remain contradicted. Numeric reproduction, scientific review and theorem proof remain separate; no automatic promotion was added. Graph trace is context only, not a digest or verification receipt.

## RED / GREEN and commits

- `d6785c4`: regression tests; observed RED: two failing tests, scalar -x^2 produced 4 instead of -4 and citationExamples was absent.
- `68f49c3`: minimal fixes; focused tests passed 7/7.
- `3d8dd597b8ac75e60363c2d88186d93aa2227fb4`: stronger assertions for source locator, exact audit reproduction, contradicted status and absent top-level status.

Parent independently reviewed the scientific diff and found no concrete defect.

## Validation

Final implementation/test SHA: `3d8dd597b8ac75e60363c2d88186d93aa2227fb4`. Commands were run from this isolated worktree. Logs are outside Git in `../../outputs/fix-science-*`.

- Full unfiltered `scripts/test-full-ci.mjs`, all `tests/*.test.mjs`: Node 22.23.3 / 24.20.0 × PostgreSQL 16 / 18. All four final cells passed 373/373 tests, zero failures/skips/todo; each includes native PDF tests. Final run logs: `fix-science-final-node<VERSION>-pg<PORT>.log` (PG16 port55440, PG18 port55439).
- Separate native PDF command: `node --test tests/book-ingestion*.test.mjs tests/book-sqlite-text.test.mjs`, 76 passed, zero skips/failures.
- Browser Chromium: external isolated runner, own port4177, retries0; 14 passed. `fix-science-browser.log`.
- Focused parser/evidence tests: 7 passed; no skips.

GitHub Actions for this branch are discoverable at https://github.com/YehorBabenko88/math/actions?query=branch%3Afix%2Fscientific-evidence-consistency . Final run identities and conclusions are delivered separately after the push, since this report cannot contain its own eventual commit hash.

## Limits

This change makes independent evidence associations honest; it does not validate node output or implement sample/unit/parameter/digest binding. External consumers using `.evidence` must migrate. Tests use synthetic data/PDFs and isolated local schemas, not production datasets. No theorem is proven, scientific review granted, branch integrated, PR created or production readiness asserted.
