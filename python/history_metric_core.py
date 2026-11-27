"""Math-owned strictly bounded, source-only Euclidean numeric primitives.

The caller must independently validate immutable data, units, source, fit,
coverage, and authority. No source, database, exchange, or network I/O.
"""
from __future__ import annotations

from fractions import Fraction
import math
import struct
import sys

_MAX = Fraction.from_float(sys.float_info.max)
_MAX_FINITE_BITS = 0x7FEFFFFFFFFFFFFF
_MAX_DIMENSION = 256


def _finite(value: object) -> float:
    # No implicit int, bool, Decimal, string, or object coercions.
    if type(value) is not float or not math.isfinite(value):
        raise ValueError("INVALID_NUMBER")
    return value


# R11 proposed *logical*, conservative Fraction limb-work charge profile.
# These are budget credits, NOT CPU instructions, native memory, or authority.
# Must receive A/V numeric-cost policy ACK before a remote source commit.
_COORDINATE_OPS = 8192
_COMPARISON_OPS = 16384
_ROOT_STEPS_UPPER = 64
_FRACTION_LOGICAL_BYTES = 4096


class _Meter:
    def __init__(self, budget: object, dimensions: int, *, vectors: int, root: bool):
        self.budget = None
        self.reserved = 0
        if budget is None:
            return
        try:
            from math_resource_budget import BudgetCounter
        except ImportError:
            raise ValueError("BUDGET_EXCEEDED") from None
        if type(budget) is not BudgetCounter:
            raise ValueError("BUDGET_EXCEEDED")
        if not 1 <= dimensions <= _MAX_DIMENSION or vectors not in (0, 1, 2):
            raise ValueError("DIMENSION")
        # Upper bound covers every conversion, multiplication, accumulation,
        # and 64 exact-root comparisons. Charge actual steps below, once each.
        max_coordinates = dimensions * (vectors + 2)
        max_comparisons = _ROOT_STEPS_UPPER if root else 0
        self.reserved = _FRACTION_LOGICAL_BYTES * (max_coordinates + 16)
        budget.preflight(ops=max_coordinates * _COORDINATE_OPS
                         + max_comparisons * _COMPARISON_OPS,
                         read_bytes=dimensions * vectors * 8,
                         write_bytes=dimensions * 16,
                         live_bytes=self.reserved, output_bytes=8)
        budget.reserve_memory(self.reserved)
        self.budget = budget

    def coordinate(self, *, read: bool = False, write: bool = False) -> None:
        if self.budget is not None:
            self.budget.charge("coordinate", ops=_COORDINATE_OPS,
                               read_bytes=8 if read else 0,
                               write_bytes=8 if write else 0)

    def comparison(self) -> None:
        if self.budget is not None:
            self.budget.charge("comparison", ops=_COMPARISON_OPS)

    def output(self) -> None:
        if self.budget is not None:
            self.budget.charge_output(8)

    def close(self) -> None:
        if self.budget is not None:
            self.budget.release_memory(self.reserved)
            self.budget = None


def _vector(values: object, meter: _Meter | None = None) -> tuple[Fraction, ...]:
    if type(values) not in (tuple, list) or not 1 <= len(values) <= _MAX_DIMENSION:
        raise ValueError("DIMENSION")
    result = []
    for value in values:
        if meter is not None:
            meter.coordinate(read=True)
        result.append(Fraction.from_float(_finite(value)))
    return tuple(result)


def _two_vectors(x: object, y: object, meter: _Meter | None = None) -> tuple[tuple[Fraction, ...], tuple[Fraction, ...]]:
    a, b = _vector(x, meter), _vector(y, meter)
    if len(a) != len(b):
        raise ValueError("DIMENSION")
    return a, b


def _shape(values: object) -> int:
    if type(values) not in (tuple, list) or not 1 <= len(values) <= _MAX_DIMENSION:
        raise ValueError("DIMENSION")
    return len(values)


def _project(exact: Fraction, meter: _Meter | None = None) -> float:
    if abs(exact) > _MAX:
        raise ValueError("NUMERIC_OVERFLOW")
    try:
        result = float(exact)  # Fraction correctly rounds to binary64.
    except OverflowError as exc:
        raise ValueError("NUMERIC_OVERFLOW") from exc
    if not math.isfinite(result):
        raise ValueError("NUMERIC_OVERFLOW")
    if exact and result == 0.0:
        raise ValueError("NUMERIC_UNDERFLOW")
    if meter is not None:
        meter.output()
    return 0.0 if result == 0.0 else result  # +0, not -0.


def _float_bits(bits: int) -> float:
    return struct.unpack(">d", bits.to_bytes(8, "big"))[0]


def _sqrt_exact(squared: Fraction, meter: _Meter | None = None) -> float:
    """Nearest-even binary64 sqrt using exact rational comparisons.

    A monotone 63-iteration search brackets sqrt, then the exact squared
    midpoint selects the nearest representable float (even bits on a tie).
    It never forms an overflowed floating-point square or rounded difference.
    """
    if squared < 0:
        raise ValueError("INVALID_NUMBER")
    if squared == 0:
        if meter is not None:
            meter.output()
        return 0.0
    if squared > _MAX * _MAX:
        raise ValueError("NUMERIC_OVERFLOW")
    lo, hi = 0, _MAX_FINITE_BITS
    while lo < hi:
        if meter is not None:
            meter.comparison()
        middle = (lo + hi + 1) // 2
        candidate = Fraction.from_float(_float_bits(middle))
        if candidate * candidate <= squared:
            lo = middle
        else:
            hi = middle - 1
    if lo == _MAX_FINITE_BITS:
        if meter is not None:
            meter.output()
        return sys.float_info.max
    low_value = Fraction.from_float(_float_bits(lo))
    high_value = Fraction.from_float(_float_bits(lo + 1))
    midpoint = (low_value + high_value) / 2
    if meter is not None:
        meter.comparison()
    if squared < midpoint * midpoint:
        chosen = lo
    elif squared > midpoint * midpoint:
        chosen = lo + 1
    else:
        chosen = lo if (lo & 1) == 0 else lo + 1
    if chosen == 0:
        raise ValueError("NUMERIC_UNDERFLOW")
    if meter is not None:
        meter.output()
    return _float_bits(chosen)


def checked_norm(x: object, *, budget: object = None) -> float:
    n = _shape(x)
    meter = _Meter(budget, n, vectors=1, root=True)
    try:
        values = _vector(x, meter)
        squared = Fraction(0)
        for v in values:
            meter.coordinate(write=True)
            squared += v * v
        return _sqrt_exact(squared, meter)
    finally:
        meter.close()


def checked_dot(x: object, y: object, *, budget: object = None) -> float:
    n = _shape(x)
    meter = _Meter(budget, n, vectors=2, root=False)
    try:
        a, b = _two_vectors(x, y, meter)
        exact = Fraction(0)
        for u, v in zip(a, b):
            meter.coordinate(write=True)
            exact += u * v
        return _project(exact, meter)
    finally:
        meter.close()


def checked_distance(x: object, y: object, *, budget: object = None) -> float:
    n = _shape(x)
    meter = _Meter(budget, n, vectors=2, root=True)
    try:
        a, b = _two_vectors(x, y, meter)
        squared = Fraction(0)
        for u, v in zip(a, b):
            meter.coordinate(write=True)
            squared += (u - v) ** 2
        return _sqrt_exact(squared, meter)
    finally:
        meter.close()


def checked_mul(a: object, b: object, *, budget: object = None) -> float:
    meter = _Meter(budget, 1, vectors=2, root=False)
    try:
        meter.coordinate(read=True)
        x = Fraction.from_float(_finite(a))
        meter.coordinate(read=True)
        y = Fraction.from_float(_finite(b))
        meter.coordinate(write=True)
        return _project(x * y, meter)
    finally:
        meter.close()


def checked_div(a: object, b: object, *, budget: object = None) -> float:
    meter = _Meter(budget, 1, vectors=2, root=False)
    try:
        meter.coordinate(read=True)
        numerator = Fraction.from_float(_finite(a))
        meter.coordinate(read=True)
        denominator = Fraction.from_float(_finite(b))
        if denominator == 0:
            raise ValueError("ZERO_DIVISOR")
        meter.coordinate(write=True)
        return _project(numerator / denominator, meter)
    finally:
        meter.close()


def binary64_be_hex(x: object) -> str:
    value = _finite(x)
    return struct.pack(">d", 0.0 if value == 0.0 else value).hex()
