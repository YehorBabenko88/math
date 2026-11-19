# Math unified-release ownership and baseline — 2026-11-19

Parent: [Unified MASTER #111](https://github.com/YehorBabenko88/unified-system/issues/111). Owner issue: [Math #119](https://github.com/YehorBabenko88/math/issues/119).

**Status: SOURCE-ONLY INITIAL AUDIT / NO_GO.** This document does not authorize merge, deletion, physical Windows execution, database changes, external provider requests or real orders.

## Immutable initial observations

- `main`: `ccfe97dd88b1ebee9bd19795002a30d0bd1c1ca3`; only `README.md` at root.
- Existing Draft PR #117: `d4bef309be3a78d790433bcd2d880927a20e32c0`, stacked on #116 `b9c2f24b33285b7b0e06aebc354a9c61a909d204`. This is **not** a merged release baseline.
- #117 exact-head Actions snapshot: PASS: Browser E2E, Agent7 history statistics finite evidence, Windows Deployment Contracts, Q01 Windows Containment Preparation, Validate Math Universe, Non-qualifying Windows JSON cmdlet diagnosis, bounded-math-experiment, Book Ingestion Native PDF, Central Scientific Engine Contracts, PostgreSQL Integration. FAIL: **history-integration** and **Q01 Queue Reliability**. Passing isolated workflows does not qualify the integrated runtime.
- The candidate tree contains `python/history_{nonlinear,sizing,stochastic,timeseries,statistics}.py`, `python/history_contract.py`, `python/history_scientific_worker.py`, `scripts/history/parity.py`, tests and 23 workflow files. This is a path inventory, not a verified dependency/call graph.
- Existing independent source-only audit [Unified PR #109](https://github.com/YehorBabenko88/unified-system/pull/109) confirmed exact-byte duplicates at its pinned candidate heads: Grid `grid/nonlinear_research.py` vs Math `python/history_nonlinear.py`; `grid/position_sizing_research.py` vs `python/history_sizing.py`; `grid/stochastic_research.py` vs `python/history_stochastic.py`; `grid/timeseries_research.py` vs `python/history_timeseries.py`; and `scripts/history_ci.py` in both. Current HEAD equality and semantic parity must be reverified before migration.

## Proposed ownership (requires MASTER agreement)

- **Math owns:** pure mathematical transforms, numerical/statistical/scientific algorithms, independent proof/validation, deterministic tolerance and uncertainty policy.
- **Grid owns:** exchange capture, market-data normalization and raw provenance, market-data persistence; consumes pinned Math kernels where applicable.
- **Strattester owns:** strategy lifecycle, backtesting, walk-forward/OOS experiments, paper execution and experiment results; calls Math for scientific computations.
- **Meta Analyse owns:** distinct order-flow/levels analytics only where nonduplicative; consumes Grid market data and Math kernels.
- **Terminan owns:** the sole operator UI; read-only display of Math results through a Gateway.
- **Unified System owns:** installation, lifecycle, authorization and integration. Math does not create a second installer, terminal, collector or order executor.

## Proposed versioned compute contract (DESIGN ONLY)

Request `math.compute.v1`: `request_id`, `algorithm_id`, `algorithm_version`, `kernel_commit_sha`, `input_schema_version`, `instrument_id` (if market-related), `source_snapshot_id`, `source_digest`, `observation_cutoff_utc`, `input_units`, `parameters`, `numeric_policy` (precision, rounding, finite-only, tolerances), `evaluation_split` (train/validation/test bounds and embargo when applicable).

Response: `request_id`, `status` (VERIFIED/UNVERIFIED/REFUSED), `algorithm_version`, `kernel_commit_sha`, `output_schema_version`, `output_units`, `values`, `uncertainty`, `tolerances`, `source_digest`, `observation_cutoff_utc`, `proof_or_test_receipt`, `warnings`. An absent or invalid provenance, units, algorithm pin, numerical bound or OOS separation must not produce VERIFIED. A receipt is not by itself proof of scientific correctness. This is **not an implemented endpoint**.

## Required gates before any migration

1. Paginate all open PRs and non-main refs; record exact head/base/lineage and entrypoint usage. No branch deletion.
2. Reproduce both failing #117 workflows at their exact head, inspect failed jobs, isolate root causes without suppressing tests.
3. Compare duplicate blob IDs at current heads, trace imports and runtime entrypoints; run numerical parity and adverse/overflow/NaN/Inf tests on each candidate algorithm.
4. Agree ownership and versioned schema with Grid, Strattester, Meta Analyse, Terminan and MASTER before changing imports.
5. Run full-history and PR-ref secret scanning with redacted evidence; audit CI action pins, OIDC, dependencies and artifact disclosure. **Security clearance not established.**
6. Verify deterministic scientific outputs, units, error bounds, OOS/lookahead controls, rollback and historical-data preservation.
7. Run independent Linux/Windows contract and physical integration acceptance; only then consider main consolidation.

## Keep / retire decisions

**KEEP:** all existing source branches, PRs, tests, pinned evidence, numerical references and recovery artifacts until independent review. **CANDIDATE FOR LATER RETIREMENT:** duplicate Grid mathematical kernel implementations after owner-approved parity and consumers migrated. **UNKNOWN:** which historical Math PR heads and support files are redundant; do not delete.

**Blocking:** failing #117 CI; main has no executable Math release; no accepted cross-repo compute contract; no full-history secret clearance; no cross-repo numerical parity; no physical E2E. Overall **NO_GO**.
