"""Math-owned domain statistics with bounded deterministic research inputs.

No provider, order, persistence, or strategy policy is implemented here.
"""
import math
import random
import statistics


def _finite_mean(values):
    if not values or any(not math.isfinite(value) for value in values):
        raise ValueError("bootstrap values must be finite")
    try:
        result = math.fsum(values) / len(values)
    except OverflowError:
        result = statistics.mean(values)
    if not math.isfinite(result):
        raise ValueError("bootstrap mean must be finite and representable")
    return result


def _finite_observation(value):
    if isinstance(value, (bool, str, bytes, bytearray)):
        raise ValueError("bootstrap values must be numeric")
    try:
        value = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError("bootstrap values must be finite and numeric") from exc
    if not math.isfinite(value):
        raise ValueError("bootstrap values must be finite")
    return value


def _indexed(observations):
    result = {}
    for identifier, value in observations:
        if identifier is None:
            continue
        if identifier in result:
            raise ValueError("duplicate observation identifier in paired bootstrap")
        result[identifier] = _finite_observation(value)
    return result


def paired_observation_bootstrap(base, variant, runs=1000, seed=17):
    """Bootstrap paired differences over iterables of (identifier, value)."""
    if isinstance(runs, bool) or not isinstance(runs, int) or runs < 1:
        raise ValueError("runs must be a positive integer")
    b = _indexed(base)
    v = _indexed(variant)
    ids = sorted(set(b) & set(v), key=str)
    if len(ids) < 2:
        return {"paired": len(ids), "delta_mean": None, "ci95": None}
    diffs = [v[i] - b[i] for i in ids]
    delta_mean = _finite_mean(diffs)
    rng = random.Random(seed)
    means = [_finite_mean([diffs[rng.randrange(len(diffs))] for _ in diffs]) for _ in range(runs)]
    means.sort()
    lo = means[int(.025 * (runs - 1))]
    hi = means[int(.975 * (runs - 1))]
    return {"paired": len(ids), "delta_mean": delta_mean, "ci95": [lo, hi],
            "positive_supported": lo > 0, "negative_supported": hi < 0}


def block_observation_bootstrap(observations, block_size=20, runs=1000, seed=23):
    """Bootstrap the mean of ordered numeric observations in contiguous blocks."""
    if isinstance(block_size, bool) or not isinstance(block_size, int) or block_size < 1:
        raise ValueError("block_size must be a positive integer")
    if isinstance(runs, bool) or not isinstance(runs, int) or runs < 1:
        raise ValueError("runs must be a positive integer")
    values = [_finite_observation(value) for value in observations]
    if len(values) < max(2, block_size):
        return {"samples": len(values), "ci95": None}
    blocks = [values[i:i + block_size] for i in range(0, len(values), block_size)
              if len(values[i:i + block_size]) == block_size]
    rng = random.Random(seed)
    means = []
    for _ in range(runs):
        sample = []
        while len(sample) < len(values):
            sample.extend(blocks[rng.randrange(len(blocks))])
        means.append(_finite_mean(sample[:len(values)]))
    means.sort()
    return {"samples": len(values), "blocks": len(blocks),
            "ci95": [means[int(.025 * (runs - 1))], means[int(.975 * (runs - 1))]]}
