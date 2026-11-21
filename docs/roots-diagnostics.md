# Polynomial root convergence diagnostics

`roots()` retains its exact legacy implementation and return type. It returns approximations, including on iteration exhaustion. No caller or UI is switched automatically.

```js
import {rootsWithDiagnostics} from './src/math.mjs';
const result = rootsWithDiagnostics([1, 0, 0, -1], {maxIterations: 1});
// converged:false, iterations:1, reason:'MAX_ITERATIONS'
// maxResidual ≈ 2.1380937326944993
```

The new opt-in API uses the same simultaneous Durand–Kerner starting points and updates, with explicit arithmetic guards and a separate stopping contract. Real finite coefficients are supplied in descending order. Input is copied; sparse/non-numeric/non-finite coefficients and a zero leading coefficient are rejected. Degree must be at least1. Arrays and finite numeric typed arrays are supported.

Options:

| Option | Default | Meaning |
|---|---:|---|
| maxIterations | 500 | Nonnegative safe integer; maximum attempted simultaneous sweeps |
| tolerance | 1e-9 | Positive finite absolute step tolerance |
| residualTolerance | tolerance | Nonnegative finite absolute residual threshold |

Result:

- `roots`: complex candidate objects `{re,im}`. These are approximations, not certified roots. On failed update, the preceding complete finite candidate set is retained. Empty array means no usable finite initialization/normalization was available.
- `converged`: true only for CONVERGED.
- `iterations`: attempted update sweeps, including a failed arithmetic sweep. Analytic degree-one evaluation uses0 sweeps, independently of the iterative budget.
- `maxResidual`: maximum `hypot(Re(P(z)),Im(P(z)))` computed using original coefficients and floating-point Horner evaluation.
- `maxNormalizedResidual`: the analogous metric for the monic normalized polynomial. Checking both avoids interpreting tiny coefficient scale alone as convergence.
- `reason`: CONVERGED, MAX_ITERATIONS, NON_FINITE, NORMALIZATION_UNDERFLOW, STAGNATION, or RESIDUAL_NOT_MET.

Unrepresentable residual metrics are `null`, never NaN/Infinity; this is not a zero residual. Returned candidates remain finite. NON_FINITE includes invalid/overflowing division intermediates and division breakdown. NORMALIZATION_UNDERFLOW refuses to silently discard a nonzero input coefficient. STAGNATION means no candidate coordinate changed while success criteria were unmet. RESIDUAL_NOT_MET is used when the analytic linear candidate cannot meet the requested residual threshold.

For iterative success, every candidate, step, checked complex division intermediate and both residual metrics must be finite; the largest step must be strictly less than tolerance and **both** residual metrics must be at most residualTolerance. A small step alone never suffices. If those tests do not pass, exhausting the budget returns converged=false. Passing the criteria on the last permitted sweep is genuine criterion-based termination, not a blanket success-on-budget rule. With zero iterative budget, nonlinear problems return MAX_ITERATIONS without claiming success. Analytic linear evaluation can succeed with iterations0.

## Limitations

This is diagnostic instrumentation, not a new robust polynomial solver. It does not balance coefficients, use compensated/interval evaluation, estimate conditioning, restart collisions, certify multiplicities or prove root completeness. High degree, clustered/multiple roots and extreme coefficient ranges can overflow, stagnate or converge slowly. The conservative guards can refuse computations a more sophisticated scaled solver might handle.

Residual checks are binary64 measurements of floating-point polynomials. Cancellation/underflow can make a residual look smaller than its true mathematical value. Small residual does not bound forward root error for ill-conditioned or multiple roots. A double root can have forward error much larger than its residual. `residualTolerance:0` means exact zero **in floating-point evaluation**, not exact mathematics. Requiring absolute original and normalized residuals is deliberately not scale invariant; choose tolerances for the coefficient scale and application.

No CONVERGED result supplies a theorem proof, scientific review, interval certificate, VERIFIED/proven status or automatic knowledge promotion. The caller must inspect `converged` and `reason` and handle null metrics explicitly.
