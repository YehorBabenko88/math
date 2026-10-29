# Four-repository central Math boundary — integration v0 (Draft)

Status: **PARTIAL IMPLEMENTATION / NO MERGE / NO DEPLOYMENT**.

## Ownership

- **Grid** owns exchange collection, immutable candle/trade-footprint capture, qualified source identity and read-only PostgreSQL access. The 1.1 footprint is executed-trade aggregation, **not L2 order-book depth**.
- **Math** owns validated time-series transforms, numerical kernels, model fitting, causal scientific DAG, explainable provenance traces, and historical-only research evaluation. Math does **not** send exchange orders or mutate market PostgreSQL. Existing browser 3D/knowledge modules remain functional.
- **Strattester** owns strategy specifications, experiment scheduling, historical replay, training and simulator orchestration, costs/fees/funding assumptions, walk-forward cutoffs, OOS receipts. It calls Math for mathematical transforms rather than copying algorithms; no strategy promotion from Math scores alone.
- **Terminan** owns UI presentation, graph canvas, dragging/linking widgets, experiment parameters and review of immutable artifacts. It never computes quantitative research independently or connects directly to privileged Grid DB roles.

## Proposed data flow

Grid authenticated snapshot/revision -> versioned read-only **as-of** adapter -> Math typed input -> Math deterministic outputs and scientific graph -> Strattester historical simulator/training -> signed/pinned results -> Terminan visualizations.

Separate forward UI requests from backend compute. Default state is UNAVAILABLE until all independent source/provenance gates pass; do not silently substitute fixtures or rebrand aggregate buy/sell delta as L2 imbalance.

### Contracts (to be implemented)

Snapshot envelope: schemaVersion, datasetFingerprint, sourceId/revision/epoch, venue/market/symbol/timeframe, event start/end, ingestion and available-at timestamps, completeness/quality/gap/watermark, decimal units, immutable ordered sample rows. Each feature retains dependency interval and latest available-at. Forecast cutoff must follow *all* upstream availability, with strictly future label horizon and closed exchange event watermark.

Experiment request: immutable snapshot reference, math graph nodes/typed ports/unit constraints, model and version, deterministic seed, train/validation/test windows, cost/execution assumptions, resource caps, explicit RESEARCH_ONLY. Avoid copying full market data through the browser.

Math result: source and graph fingerprints, exact code/dependency hashes, parameter estimates, separate in-sample/validation/test metrics, nonfinite/gap/staleness flags, warnings, model/feature DAG evidence, trace and bounded outputs, no execution or training authorization.

Strattester result: simulated fills/fees/slippage/funding, chronology, walk-forward validation, multi-instrument OOS, adverse controls, artifacts and receipts. Research score never becomes live trading authority.

### Explicit safety boundaries

1. No live orders, credentials, PostgreSQL writes, service modifications or G1 actions during these draft PRs.
2. Do not remove operational risk / sizing code from Grid while real execution depends on it; inventory and test migration feature by feature with parity and rollback.
3. Existing Grid modules possibly requiring decomposition: `barrier_simulator.py`, `book_tape_research.py`, `conditional_markov.py`, `event_conditioned_markov.py`, `nonlinear_research.py`, `scientific_simulation.py`, `stochastic_research.py`, `strategy_statistics.py`, `timeseries_research.py`, `unified_features.py`. File names are **candidates**, not proof all logic is safe to move. Ingestion integrity/normalization remains source-owned, while mathematical forecasting migrates to Math.
4. Math PR97 is a deliberately untrusted offline proof of interface: it accepts inline historical closes but cannot establish dataset provenance. Until identity/time/coverage contract is enforced, never connect to Grid or Strattester production.
5. Terminan PR48 is UI-only graph preview; its nodes do not execute or create a trusted scientific claim.

## Staged admission

G0: pinned source inventories, pure synthetic contract tests, source-to-result no-lookahead controls.

G1 (not authorized): disposable PostgreSQL read-only historical snapshot, immutable pins and independent completeness audit.

G2: exact Math compute engine and unit/provenance-aware drag/drop graph, normalized errors and resource bounds.

G3: Strattester invokes Math by immutable experiment contract; compare numerical parity with existing kernels, add negative controls and independent backtest receipts.

G4: Terminan shows full graph, graph overlays, book-derived hypotheses and held-out backtest charts, **no live actions**.

G5: physically authorized ADMINIT / LS5 system tests and deliberate deprecation of duplicates only after all consumers migrate.

### Known validation gaps

- PR97 and PR48 have NOT_RUN physical E2E. PR97 API is not a trusted or authenticated remote service.
- Source completeness for Grid #249 and real multi-source feature availability remain BLOCKED.
- Research math performance on recent real BTCUSDT data has not shown durable advantage over last-price baseline.
- Book knowledge is a versioned source of hypotheses: no automatic promotion of natural language to validated formulas; user approval, dimensions, citation pages and mathematical validation needed.
