# Issue98 Central Scientific Engine: implementation acceptance

Base: Draft PR97 b92cd96ab5a8cab048524b311f565f4fe1937b1f. Base/control candidate remains unchanged. Final exact HEAD/tree and hosted receipt are bound in the new Draft PR and exact-head CI artifacts; this report does not manufacture a self-referential commit hash.

## Architecture and scope

The existing port graph v1 compiles only a small fixed research graph; the existing experiment graph owns average/difference algorithms; expression.mjs owns AST parsing/evaluation; si-dimensions.mjs owns the SI catalog; math.mjs owns elementary methods; Book assessKnowledge owns extraction candidate validation and reject-untrusted-proof boundaries. These implementations are reused. New scientific-engine/data/units modules add an inert JSON boundary, typed versioned DAG, dimensional AST inference, named ports and chronological source/adapter contracts. No Math algorithm is copied into Terminan, Grid or Strattester.

The v2 route supports multiple outputs,128 nodes,256 edges,2048 source points,16384 aggregate evaluated values,1000000 work units and256KiB requests. Stable topological order, frozen catalog references, source/definition/output/dependency SHA256 traces and engine-owned descriptive output metrics are available. Source identity/digests/availability remain caller claims. A curated host catalog is needed for actual book formula use; the default is intentionally empty, and no source is invented. Research review never becomes scientific proof.

## Confirmed findings and RED/GREEN

- P1: v1 comparison-energy overflow returned Infinity, serialized as null at HTTP boundary. RED missing expected exception; result-finiteness check fixes publication.
- P2: SI conversion could overflow finite inputs to Infinity. RED missing exception; finite result validation fixes it.
- P2: legacy formula API echoed unrestricted extra knowledge fields, including caller status PROVEN. RED confirmed; v1 metadata now has exact nominal fields and inert JSON snapshot. Nominal v1 requests remain compatible; malformed/extraneous scientific claims are intentionally rejected.
- P2: per-chunk UTF8 decoding could alter source/formula metadata when a multibyte character crossed chunk boundaries. New strict Buffer-based decoder has every split-point regression and invalid-byte rejection. No raw errors are published.
- P2: final-value-only AST checking accepted 1/exp(1000) as finite zero despite infinite intermediate. RED confirmed; opt-in evaluateFinite validates all AST intermediates while preserving legacy evaluate.
- P2 (new implementation, caught independently): exposed capabilities input arrays changed difference sign without changing graph. RED 7 became-7; copied arrays fix mutation.
- P2 (new evidence runner, caught independently): assume-unchanged hid modified source while receipt claimed original SHA. RED confirmed using disposable git fixtures; committed blobs are checked with --no-replace-objects. Only JS/JSON checkout CRLF equivalence is allowed; raw tested hashes remain recorded. Other bytes stay exact. No historical SQL migration or ledger is altered.
- Evidence quality: test-time source mutation could be labeled unchanged in a failed receipt; RED confirmed and corrected. Skipped tests are a qualification failure, not PASS. Wrong source SHA blocks before testing.

## Local qualification

30 bounded Node test files:137 PASS,0 FAIL,0 SKIP on each Node22.23.3 and24.20.0. Includes new DAG/HTTP/resource/source/privacy and qualification-negative tests, old graph/formula/math APIs, AST precedence, units, roots diagnostics, return/walk-forward models, Book intake, knowledge registry and proof kernel boundaries. Tests use synthetic data, disposable local git fixtures and ephemeral loopback only. No ADMINIT physical/native/Token API/C#/PowerShell/PG/Q01 stress or production work executed. Full npm test is NOT_RUN because it includes unrelated native/database/laboratory workloads; no whole-repository qualification is claimed.

Exact-head Windows/Linux22/24 CI is defined separately. It executes the same complete explicit bounded inventory, verifies source before/after and rejects any skipped/cancelled/failed test. Other native/PG/Q01 jobs are branch-excluded; their SKIPPED state is NOT_RUN, not scientific acceptance. Raw logs are not uploaded; receipt+SHA256 only. GitHub jobs/attempt/artifact inventory must be checked after publication. No repeated runs or settings changes are required.

The managed worktree creation tool returned asynchronously after a fallback checkout was used. Changes were copied to the final managed feature worktree, not to an existing PR. Only the managed feature branch is published.

## Consumer contract and readiness

See docs/central-scientific-engine-v2.md and examples/scientific-graph.v2.json. Terminan developer was explicitly authorized by the user to coordinate schemas and read-only contract tests. Client rendering/proxy/browser qualification remains independently owned. Strattester/Grid integration has not been executed. No arbitrary method imports, model training, data fetching, market auth or external writes are introduced.

GO for independent code/API integration review only, subject to exact-head hosted results. NOT a production or physical GO. Native containment/isolation, security of proxy deployment, actual source licensing/review/authentication, independent mathematical proof, IEEE-754 conditioning and unsupported scientific adapters remain separate limitations.

Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED. No merges, deployment or real data migration.
