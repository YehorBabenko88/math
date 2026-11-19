"""Versioned, pure Math computation boundary for pinned consumers.

All values are untrusted until independently attested by Grid/Unified.
No market provider, DB, strategy, service or order execution is introduced.
"""
from __future__ import annotations
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
from typing import Mapping

from market_profile_math import price_bucket, volume_profile_poc, executed_volume_delta

SCHEMA = "math.market.compute.v1"
RESULT = "math.market.result.v1"
ALGORITHMS = frozenset({"price_bucket", "volume_profile_poc", "executed_volume_delta"})
MAX_BATCH = 256
MAX_REQUEST_BYTES = 262144


def _decimal(text):
    if not isinstance(text, str) or not text or len(text) > 128:
        raise ValueError("INVALID_DECIMAL_ENCODING")
    try:
        value = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError("INVALID_DECIMAL_ENCODING") from exc
    if not value.is_finite():
        raise ValueError("NONFINITE_DECIMAL")
    return value


def _record(value, fields):
    if not isinstance(value, dict) or set(value) != fields:
        raise ValueError("INVALID_FIELDS")
    return value


def _compute(item):
    _record(item, {"operation", "input"})
    operation = item["operation"]
    if type(operation) is not str or operation not in ALGORITHMS:
        raise ValueError("UNKNOWN_OPERATION")
    args = item["input"]
    if operation == "price_bucket":
        _record(args, {"price", "tick"})
        return str(price_bucket(_decimal(args["price"]), _decimal(args["tick"])))
    if operation == "executed_volume_delta":
        _record(args, {"buy", "sell"})
        return str(executed_volume_delta(_decimal(args["buy"]), _decimal(args["sell"])))
    _record(args, {"profile", "close"})
    if not isinstance(args["profile"], list) or len(args["profile"]) > 2048:
        raise ValueError("INVALID_PROFILE")
    profile = {}
    for entry in args["profile"]:
        _record(entry, {"price", "volume"})
        p = _decimal(entry["price"])
        if p in profile:
            raise ValueError("DUPLICATE_PROFILE_PRICE")
        profile[p] = _decimal(entry["volume"])
    close = None if args["close"] is None else _decimal(args["close"])
    result = volume_profile_poc(profile, close=close)
    return None if result is None else str(result)


def compute_batch(request: Mapping) -> dict:
    """Execute bounded deterministic pure numerical operations, never authorize data."""
    _record(request, {"schema", "execution_authority", "source", "operations"})
    if request["schema"] != SCHEMA or request["execution_authority"] is not False:
        raise ValueError("INVALID_CONTRACT")
    source = request["source"]
    _record(source, {"snapshot_sha256", "as_of_ms", "units"})
    digest = source["snapshot_sha256"]
    if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
        raise ValueError("INVALID_SOURCE_PIN")
    if type(source["as_of_ms"]) is not int or not 0 <= source["as_of_ms"] <= 2**63 - 1:
        raise ValueError("INVALID_SOURCE_CLOCK")
    if source["units"] != {"price": "quote/base", "volume": "base"}:
        raise ValueError("INVALID_UNITS")
    operations = request["operations"]
    if not isinstance(operations, list) or not 1 <= len(operations) <= MAX_BATCH:
        raise ValueError("BATCH_LIMIT")
    try:
        canonical = json.dumps(request, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode()
    except (TypeError, ValueError) as exc:
        raise ValueError("INVALID_JSON") from exc
    if len(canonical) > MAX_REQUEST_BYTES:
        raise ValueError("REQUEST_LIMIT")
    results = []
    for operation in operations:
        _record(operation, {"operation", "input"})
        results.append({"operation": operation["operation"], "value": _compute(operation)})
    return {"schema": RESULT, "request_sha256": sha256(canonical).hexdigest(),
            "source": source.copy(), "results": results,
            "provenance": "CALLER_SUPPLIED_UNATTESTED", "execution_authority": False,
            "trading_authorized": False}
