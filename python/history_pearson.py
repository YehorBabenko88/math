"""Math-only exact-dyadic Pearson developer candidate; not production qualified.

Inputs are prealigned, same-support, caller-supplied represented binary64 values.
The caller (I/A) owns event-time, availability, source, split and unit checks.
The caller (V) owns shared work/memory quotas; local caps are fail-closed ceilings.
Developer-only candidate; not independently qualified or authorized for trading.
"""
from __future__ import annotations

import math
import struct
from typing import NamedTuple


MAX_ROWS = 4096
MAX_MOMENT_BITS = 8500
MAX_COMPARISON_BITS = 12000
_ONE_BITS = 0x3FF0000000000000


class PearsonResult(NamedTuple):
    status: str
    reason_code: str | None
    rho: float | None
    n_overlap: int
    exact_perfect: bool | None
    rounded_endpoint: bool | None
    numeric_policy_ref: str


def _number(value):
    """Match legacy strict literal screening, without importing or editing it."""
    if type(value) not in (int, float):
        raise ValueError('PEARSON_LITERAL_BINARY64_REQUIRED')
    try:
        number = float(value)
    except (OverflowError, ValueError) as exc:
        raise ValueError('PEARSON_FINITE_BINARY64_REQUIRED') from exc
    if not math.isfinite(number) or (type(value) is int and number != value):
        raise ValueError('PEARSON_LOSSLESS_FINITE_BINARY64_REQUIRED')
    return number


def _aligned_integer_values(values):
    ratios = [value.as_integer_ratio() for value in values]
    shift = max(denominator.bit_length() - 1 for _, denominator in ratios)
    integers = []
    for numerator, denominator in ratios:
        scaled = numerator << (shift - denominator.bit_length() + 1)
        if scaled.bit_length() > 2100:
            raise ValueError('PEARSON_SCALED_INTEGER_LIMIT')
        integers.append(scaled)
    return integers


def _moments(x, y):
    xx = _aligned_integer_values(x)
    yy = _aligned_integer_values(y)
    n = len(x)
    sx = sy = sxx = syy = sxy = 0
    for a, b in zip(xx, yy):
        sx += a
        sy += b
        sxx += a * a
        syy += b * b
        sxy += a * b
    a = n * sxx - sx * sx
    b = n * syy - sy * sy
    d = n * sxy - sx * sy
    if min(a, b) < 0:
        raise ValueError('PEARSON_EXACT_COVARIANCE_INVARIANT')
    if max(a.bit_length(), b.bit_length(), abs(d).bit_length()) > MAX_MOMENT_BITS:
        raise ValueError('PEARSON_MOMENT_BIT_BUDGET')
    return a, b, d


def _as_float_bits(bits):
    return struct.unpack('!d', bits.to_bytes(8, 'big'))[0]


def _square_le_ratio(bits, numerator, denominator):
    q, s = _as_float_bits(bits).as_integer_ratio()
    if numerator.bit_length() + 2 * s.bit_length() > MAX_COMPARISON_BITS + 2:
        raise ValueError('PEARSON_COMPARISON_BIT_BUDGET')
    if denominator.bit_length() + 2 * abs(q).bit_length() > MAX_COMPARISON_BITS + 2:
        raise ValueError('PEARSON_COMPARISON_BIT_BUDGET')
    return q * q * denominator <= numerator * s * s


def _round_sqrt_ratio(numerator, denominator):
    """Nearest-even binary64 sqrt(numerator/denominator), using exact integers."""
    if numerator == 0:
        return 0.0
    if not 0 < numerator <= denominator:
        raise ValueError('PEARSON_CAUCHY_INVARIANT')
    if numerator == denominator:
        return 1.0

    low, high = 0, _ONE_BITS
    while high - low > 1:
        mid = (low + high) // 2
        if _square_le_ratio(mid, numerator, denominator):
            low = mid
        else:
            high = mid
    if _square_le_ratio(high, numerator, denominator):
        return _as_float_bits(high)

    q0, d0 = _as_float_bits(low).as_integer_ratio()
    q1, d1 = _as_float_bits(high).as_integer_ratio()
    # Denominators are powers of two: use the least common denominator,
    # NOT their product. The latter creates unnecessary huge integers.
    common = max(d0, d1)
    midpoint_numer = q0 * (common // d0) + q1 * (common // d1)
    midpoint_denom = 2 * common
    if (numerator.bit_length() + 2 * midpoint_denom.bit_length() > MAX_COMPARISON_BITS + 2 or
            denominator.bit_length() + 2 * abs(midpoint_numer).bit_length() > MAX_COMPARISON_BITS + 2):
        raise ValueError('PEARSON_COMPARISON_BIT_BUDGET')
    left = numerator * midpoint_denom * midpoint_denom
    right = denominator * midpoint_numer * midpoint_numer
    if left < right:
        return _as_float_bits(low)
    if left > right:
        return _as_float_bits(high)
    return _as_float_bits(low if low % 2 == 0 else high)


# Versioned shared-V *logical* work policy. These are deliberately pessimistic
# credits, NOT a bound on native interpreter instructions, heap usage or RSS.
# An actual market/selector qualification requires independent source/fit receipts.
_PEARSON_WORK_PROFILE = 'pearson-dyadic-logical-v1'
_ROW_SERIES_CREDITS = 32768
_PAIRED_MOMENT_CREDITS = 131072
_WIDE_STAGE_CREDITS = 262144
_MAX_SQRT_COMPARISONS = 64
_INTEGER_SLOT_BYTES = 4096
_WIDE_SLOT_BYTES = 8192
_OUTPUT_BYTES = 256


def _budget_costs(n):
    # Six logical retained integer/value slots per row cover both immutable
    # observations, aligned integers, temporary exact-ratio lists and staging.
    # 32 wide scratch slots cover covariance, ratio and midpoint temporaries.
    return {
        'ops': (2*n*_ROW_SERIES_CREDITS +
                n*_PAIRED_MOMENT_CREDITS +
                (1+_MAX_SQRT_COMPARISONS)*_WIDE_STAGE_CREDITS),
        'read_bytes': 16*n,
        'write_bytes': 32*n,
        'live_bytes': 6*n*_INTEGER_SLOT_BYTES+32*_WIDE_SLOT_BYTES,
        'output_bytes': _OUTPUT_BYTES,
    }


def _pearson_core(x, y, *, min_overlap, numeric_policy_ref):
    # Input screening, exact dyadic arithmetic and binary64 rounding are kept
    # identical in unmetered developer tests and shared-counter composition.
    xs = tuple(_number(item) for item in x)
    ys = tuple(_number(item) for item in y)
    n = len(xs)
    if n < min_overlap:
        return PearsonResult('REFUSED', 'INSUFFICIENT_OVERLAP', None, n, None, None,
                             numeric_policy_ref)
    a, b, d = _moments(xs, ys)
    if a == 0 or b == 0:
        return PearsonResult('REFUSED', 'CONSTANT', None, n, None, None, numeric_policy_ref)
    num = d * d
    den = a * b
    if num > den:
        raise ValueError('PEARSON_EXACT_CAUCHY_INVARIANT')
    try:
        magnitude = _round_sqrt_ratio(num, den)
    except ValueError as exc:
        if str(exc).endswith('BIT_BUDGET'):
            return PearsonResult('REFUSED', 'NUMERIC_REFUSED', None, n, None, None,
                                 numeric_policy_ref)
        raise
    if num != 0 and magnitude == 0.0:
        return PearsonResult('REFUSED', 'NUMERIC_REFUSED', None, n, None, None,
                             numeric_policy_ref)
    result = (-magnitude if d < 0 else magnitude) if d != 0 else 0.0
    perfect = num == den
    return PearsonResult('OK', None, result, n, perfect,
                         abs(result) == 1.0 and not perfect, numeric_policy_ref)


def pearson_aligned_v1(x, y, *, min_overlap=3, numeric_policy_ref, budget=None):
    """Exact binary64 Pearson on pre-aligned inputs, no source attestation.

    If budget is supplied, require the exact V-owned BudgetCounter type and
    charge the shared logical H_WORK_V1 worst-case before calculation. This
    is a developer metering integration only; it grants no native resources,
    market source authority, causal eligibility or proof of predictive power.
    """
    if (type(x) not in (list, tuple) or type(y) not in (list, tuple) or
            len(x) != len(y) or len(x) > MAX_ROWS):
        raise ValueError('PEARSON_EXACT_EQUAL_BOUNDED_SUPPORT_REQUIRED')
    if type(min_overlap) is not int or not 2 <= min_overlap <= MAX_ROWS:
        raise ValueError('PEARSON_MIN_OVERLAP_POLICY')
    if (type(numeric_policy_ref) is not str or len(numeric_policy_ref) != 64 or
            any(char not in '0123456789abcdef' for char in numeric_policy_ref)):
        raise ValueError('PEARSON_NUMERIC_POLICY_REF_REQUIRED')
    if budget is None:
        return _pearson_core(x, y, min_overlap=min_overlap,
                             numeric_policy_ref=numeric_policy_ref)

    # H must never introduce a second budget counter or accept a duck-typed
    # fake. An isolated H branch without V refuses the metered path.
    try:
        from math_resource_budget import BudgetCounter
    except ImportError as exc:
        raise ValueError('PEARSON_SHARED_BUDGET_DEPENDENCY_UNAVAILABLE') from exc
    if type(budget) is not BudgetCounter:
        raise ValueError('PEARSON_INVALID_SHARED_BUDGET')

    n = len(x)
    costs = _budget_costs(n)
    budget.preflight(**costs)
    acquired = False
    try:
        budget.reserve_memory(costs['live_bytes'])
        acquired = True
        # Full worst-case credits billed before any input conversion or bigint
        # arithmetic. Constant/short samples may overpay but never underpay.
        budget.charge('pearson', ops=costs['ops'],
                      read_bytes=costs['read_bytes'],
                      write_bytes=costs['write_bytes'])
        result = _pearson_core(x, y, min_overlap=min_overlap,
                               numeric_policy_ref=numeric_policy_ref)
        # No result escapes if shared output accounting exhausts.
        budget.charge_output(costs['output_bytes'])
        return result
    finally:
        if acquired:
            # V allows scratch release even after terminal exhaustion.
            budget.release_memory(costs['live_bytes'])
