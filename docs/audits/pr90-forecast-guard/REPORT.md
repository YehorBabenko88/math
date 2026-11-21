# Causal forecast guard acceptance

Base PR90 773aa361f37e67c6c61031ff787d8f77eec92811 unchanged. Separate opt-in feature branch.

P1 numerical risk reproduced: cubic extrapolation amplifies normalized deviations. Example mean100/sd2/mu0.2/beta0.1, previous120: z10, prediction-76, absolute deviation196. This is model extrapolation risk, not proof of the exact ADMINIT dataset cause; its source series/options are unavailable.

RED: missing step API; GREEN: causal step + explicit immutable-per-window policy, train-only domain, per-step fallback, raw/guarded/selected comparison. Independent static review identified nonfinite validation metrics silently choosing NAIVE. Separate RED Missing expected exception captured, then guarded-mode finite validation check added. Original mode retained.

Local Node22.23.3 and24.20.0:28 PASS,0 FAIL,0 SKIP each, seven bounded test files. Legacy base comparison: exact parameters/validation/selection/test metrics for synthetic windows100/200/500. Full project suite intentionally NOT_RUN (includes forbidden native/PG/Q01 workloads). Windows/Linux exact-head CI pending at commit; see PR receipt for final status.

No lookahead: forecast API has no current/future actual argument; mutation of label85 leaves predictions through85 unchanged. Later forecasts may use the now-observed price85. Train domain and explicit policy never adapt to test labels. Invalid policy/state throws. Nonfinite raw prediction falls back with null diagnostics; metric overflow fails closed.

Synthetic comparison includes ordinary-domain deterioration, demonstrating no RMSE improvement guarantee. Strict train min/max may reject harmless new extremes. maxDeviation is price-unit dependent; thresholds are illustrative, not financial recommendations. Finite extreme naive moves can still overflow evaluation metrics and throw. No source-data physical run, trading integration, PG/native/API execution or production qualification.

Q01 OPEN. Physical G1 BLOCKED. Production NO-GO. Book gate CLOSED.
