# Causal binary64 volatility kernel

causal_volatility_metrics owns all numerical operations previously in Strattester VolatilityObservatory. Literal finite binary64-convertible OHLCV input, explicit UTC-ms start/duration, ordered nonoverlapping rows, bounded4096 rows/window/lookback and2million nominal work are required. Inputs are detached to tuples before formulas. Outputs have no provenance, coverage, strategy or execution authority. This is observational binary64 arithmetic, not Decimal trade accounting.

The seven metrics and prior-only percentile/regime boundaries preserve the original formulas on admitted inputs. No future candle changes a prior result; malformed/unbounded/derived-nonfinite batches refuse. Original differential evidence:96groups/1232records exact perPython3.11/3.12 on deterministic finite binary64 input.

Terminan owns typed presentation/lifecycle of results. Legacyconsumer bootstrap migration and cleanup are not yet accepted; no original547 function deduction yet.

## Declared availability ABI v2

Every eight-field row must supply literal UTC-ms available_at_ms between its bar end and253402300799999. No missing-field/default/compatibility inference is accepted. The result second field is max declared availability over every consumed row, including warmup/prior-close/prior-percentile dependencies. These are CALLER_DECLARED clocks, not source authentication, physical availability, PIT attestation or execution authority. Numerical formulas are unchanged. Synthetic fixtures explicitly declare close clocks; production callers must retain their actual declared clocks.
