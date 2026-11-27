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


def _vector(values: object) -> tuple[Fraction, ...]:
    if type(values) not in (tuple, list) or not 1 <= len(values) <= _MAX_DIMENSION:
        raise ValueError("DIMENSION")
    return tuple(Fraction.from_float(_finite(v)) for v in values)


def _two_vectors(x: object, y: object) -> tuple[tuple[Fraction, ...], tuple[Fraction, ...]]:
    a, b = _vector(x), _vector(y)
    if len(a) != len(b):
        raise ValueError("DIMENSION")
    return a, b


def _pure_only(budget: object) -> None:
    # V's counter is not integrated into this isolated, non-qualified slice.
    # Refuse an offered counter instead of silently failing to charge it.
    if budget is not None:
        raise ValueError("BUDGET_EXCEEDED")


def _project(exact: Fraction) -> float:
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
    return 0.0 if result == 0.0 else result  # +0, not -0.


def _float_bits(bits: int) -> float:
    return struct.unpack(">d", bits.to_bytes(8, "big"))[0]


def _sqrt_exact(squared: Fraction) -> float:
    """Nearest-even binary64 sqrt using exact rational comparisons.

    A monotone 63-iteration search brackets sqrt, then the exact squared
    midpoint selects the nearest representable float (even bits on a tie).
    It never forms an overflowed floating-point square or rounded difference.
    """
    if squared < 0:
        raise ValueError("INVALID_NUMBER")
    if squared == 0:
        return 0.0
    if squared > _MAX * _MAX:
        raise ValueError("NUMERIC_OVERFLOW")
    lo, hi = 0, _MAX_FINITE_BITS
    while lo < hi:
        middle = (lo + hi + 1) // 2
        candidate = Fraction.from_float(_float_bits(middle))
        if candidate * candidate <= squared:
            lo = middle
        else:
            hi = middle - 1
    if lo == _MAX_FINITE_BITS:
        return sys.float_info.max
    low_value = Fraction.from_float(_float_bits(lo))
    high_value = Fraction.from_float(_float_bits(lo + 1))
    midpoint = (low_value + high_value) / 2
    if squared < midpoint * midpoint:
        chosen = lo
    elif squared > midpoint * midpoint:
        chosen = lo + 1
    else:
        chosen = lo if (lo & 1) == 0 else lo + 1
    if chosen == 0:
        raise ValueError("NUMERIC_UNDERFLOW")
    return _float_bits(chosen)


def checked_norm(x: object, *, budget: object = None) -> float:
    _pure_only(budget)
    values = _vector(x)
    squared = sum((v * v for v in values), Fraction(0))
    return _sqrt_exact(squared)


def checked_dot(x: object, y: object, *, budget: object = None) -> float:
    _pure_only(budget)
    a, b = _two_vectors(x, y)
    exact = sum((u * v for u, v in zip(a, b)), Fraction(0))
    return _project(exact)


def checked_distance(x: object, y: object, *, budget: object = None) -> float:
    _pure_only(budget)
    a, b = _two_vectors(x, y)
    squared = sum(((u - v) ** 2 for u, v in zip(a, b)), Fraction(0))
    return _sqrt_exact(squared)


def checked_mul(a: object, b: object, *, budget: object = None) -> float:
    _pure_only(budget)
    return _project(Fraction.from_float(_finite(a)) * Fraction.from_float(_finite(b)))


def checked_div(a: object, b: object, *, budget: object = None) -> float:
    _pure_only(budget)
    numerator, denominator = Fraction.from_float(_finite(a)), Fraction.from_float(_finite(b))
    if denominator == 0:
        raise ValueError("ZERO_DIVISOR")
    return _project(numerator / denominator)


def binary64_be_hex(x: object) -> str:
    value = _finite(x)
    return struct.pack(">d", 0.0 if value == 0.0 else value).hex()
