# Opt-in causal walk-forward guard

Pass guard: {maxAbsZ: 2, maxDeviation: 3} explicitly to evaluateWalkForward. Numbers above are synthetic examples, not calibrated financial thresholds. maxDeviation uses original price units; thresholds must be decided before evaluation, never tuned to test labels. Omitted/null guard preserves raw model selection and metrics.

Training-only mean/sd and minZ/maxZ are frozen from the initial 60% train block. Model choice still uses the next 20% validation block. For each final 20% one-step forecast, only the previous observed price is used. Domain acceptance is the intersection of train [minZ,maxZ] and [-maxAbsZ,maxAbsZ]. Outside either domain, excessive absolute raw prediction minus previous price, or nonfinite arithmetic yields previous-price fallback. Invalid state/policy throws, never returns authority. Raw overflow metrics are null in guarded mode; guarded/selected metric overflow throws.

Window diagnostics include mean/sd, frozen domain/policy, fallbackCount and per-step z, absoluteDeviation, raw/guarded/selected predictions and reasons. selected remains the validation choice LANDAU/NAIVE; guard can override individual model predictions. fallbackCount counts raw model guard interventions even when validation selected NAIVE. guardedRMSE measures guarded model independently of validation selection. modelRMSE remains the raw benchmark. Do not interpret a null raw metric as success.

The cubic change is sd*(mu*z-beta*z^3), so extrapolation outside training scale can explode. Guard does not repair model validity, guarantee RMSE improvement, anticipate the first unseen jump, or permit trading. After a jump has been observed, it can affect the next one-step forecast legitimately. No future/current actual label is passed to forecastLandauStep. This is not a multi-step recursive forecast.

Reproduce synthetic comparison: node scripts/numerical/walk-forward-guard-comparison.mjs

The exact ADMINIT RMSEs cannot be reconstructed without its original chronological input and options; no private price data is included. No physical execution or trading qualification is claimed.
