"""Versioned, pure Math computation boundary for pinned consumers.

All values are untrusted until independently attested by Grid/Unified.
No market provider, DB, strategy, service or order execution is introduced.
"""
from __future__ import annotations
from decimal import Context, Decimal, InvalidOperation, ROUND_HALF_UP, localcontext
from hashlib import sha256
import json
from typing import Mapping

from market_profile_math import (price_bucket, volume_profile_poc, executed_volume_delta,
                                 wall_notional, untouched_decimal_levels,
                                 tape_velocity_metrics, flow_window_metrics, wall_turnover_ratios,
                                 orderflow_volume_metrics, aggregate_orderflow, aggregate_orderflow_stream)

STREAM_ABI = "math.market.orderflow.stream.v1"
SCHEMA = "math.market.compute.v1"
RESULT = "math.market.result.v1"
ALGORITHMS = frozenset({"price_bucket", "volume_profile_poc", "executed_volume_delta",
                        "wall_notional", "untouched_decimal_levels", "tape_velocity_metrics",
                        "flow_window_metrics", "wall_turnover_ratios", "orderflow_volume_metrics",
                        "aggregate_orderflow"})
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
    parts = value.as_tuple()
    if len(parts.digits) > 38 or not -30 <= parts.exponent <= 30:
        raise ValueError("DECIMAL_DOMAIN")
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
    if operation == "wall_notional":
        _record(args, {"price", "size"})
        return str(wall_notional(_decimal(args["price"]), _decimal(args["size"])))
    if operation == "untouched_decimal_levels":
        _record(args, {"candles"})
        if not isinstance(args["candles"], list) or len(args["candles"]) > 2048:
            raise ValueError("CANDLE_LIMIT")
        rows = []
        for candle in args["candles"]:
            _record(candle, {"start_ms", "high", "low", "complete"})
            if candle["complete"] is not True:
                raise ValueError("UNCLOSED_CANDLE")
            rows.append((candle["start_ms"], _decimal(candle["high"]), _decimal(candle["low"])))
        return [{"side":side,"price":str(price),"origin_ms":start}
                for side,price,start in untouched_decimal_levels(rows)]
    if operation == "tape_velocity_metrics":
        _record(args, {"events", "level_price", "tick_size", "window_ms", "proximity_ticks",
                       "now_ms", "observed_price", "contiguous"})
        if args["contiguous"] is not True:
            raise ValueError("UNTRUSTED_TAPE_CONTINUITY")
        events = args["events"]
        if not isinstance(events, list) or len(events) > 2048:
            raise ValueError("TAPE_LIMIT")
        decoded = []
        prev = None
        for event in events:
            _record(event, {"timestamp_ms", "price", "quantity", "side"})
            stamp = event["timestamp_ms"]
            if type(stamp) is not int or stamp < 0 or prev is not None and stamp < prev:
                raise ValueError("NONMONOTONIC_TAPE")
            prev = stamp
            decoded.append((stamp, _decimal(event["price"]), _decimal(event["quantity"]), event["side"]))
        observed = None if args["observed_price"] is None else _decimal(args["observed_price"])
        result = tape_velocity_metrics(decoded, _decimal(args["level_price"]),
                   _decimal(args["tick_size"]), args["window_ms"],
                   _decimal(args["proximity_ticks"]), args["now_ms"], observed_price=observed)
        return {"trades_per_second":str(result[0]),"notional_per_second":str(result[1]),
                "buy_notional":str(result[2]),"sell_notional":str(result[3]),
                "distance_ticks":None if result[4] is None else str(result[4])}
    if operation == "flow_window_metrics":
        _record(args, {"events", "now_ms", "window_seconds"})
        events = args["events"]
        if not isinstance(events, list) or len(events) > 2048:
            raise ValueError("FLOW_LIMIT")
        decoded = []
        for event in events:
            _record(event, {"timestamp_ms", "notional", "side"})
            decoded.append((event["timestamp_ms"], _decimal(event["notional"]), event["side"]))
        result = flow_window_metrics(decoded, args["now_ms"], args["window_seconds"])
        return {key: str(value) if isinstance(value, Decimal) else value
                for key,value in result.items()}
    if operation == "aggregate_orderflow":
        _record(args, {"trades", "mode", "interval_ms", "tick_size", "initial_delta"})
        rows = args["trades"]
        if not isinstance(rows, list) or len(rows) > 2048:
            raise ValueError("AGGREGATE_LIMIT")
        parsed = []
        for trade in rows:
            _record(trade, {"timestamp_ms", "price", "volume", "side"})
            parsed.append((trade["timestamp_ms"], _decimal(trade["price"]),
                           _decimal(trade["volume"]), trade["side"]))
        tick = None if args["tick_size"] is None else _decimal(args["tick_size"])
        output = aggregate_orderflow(parsed, mode=args["mode"],
                   interval_ms=args["interval_ms"], tick_size=tick,
                   initial_delta=_decimal(args["initial_delta"]))
        return [{"bucket":str(key) if isinstance(key,Decimal) else key,
                 "metrics":{name:str(value) if isinstance(value,Decimal) else value
                            for name,value in metrics.items()}}
                for key,metrics in output]
    if operation == "orderflow_volume_metrics":
        _record(args, {"trades", "initial_delta"})
        rows = args["trades"]
        if not isinstance(rows, list) or len(rows) > 2048:
            raise ValueError("TRADE_LIMIT")
        parsed = []
        for trade in rows:
            _record(trade, {"price", "volume", "side"})
            parsed.append((_decimal(trade["price"]), _decimal(trade["volume"]), trade["side"]))
        result = orderflow_volume_metrics(parsed, _decimal(args["initial_delta"]))
        return {name:str(value) if isinstance(value,Decimal) else value
                for name,value in result.items()}
    if operation == "wall_turnover_ratios":
        _record(args, {"price", "size", "turnovers"})
        amounts = args["turnovers"]
        if not isinstance(amounts, dict) or set(amounts) != {"60", "300", "3600"}:
            raise ValueError("INVALID_TURNOVERS")
        result = wall_turnover_ratios(_decimal(args["price"]), _decimal(args["size"]),
                   {int(window):_decimal(amount) for window,amount in amounts.items()})
        return {"wall_usd":str(result["wall_usd"]),
                "ratios":{str(window):str(value) for window,value in result["ratios"].items()},
                "observed_turnover":{str(window):str(value)
                                     for window,value in result["observed_turnover"].items()}}
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
    # An explicit context prevents ambient caller Decimal settings from changing outputs.
    with localcontext(Context(prec=96, rounding=ROUND_HALF_UP)):
        for operation in operations:
            try:
                value = _compute(operation)
            except (InvalidOperation, OverflowError) as exc:
                raise ValueError("NUMERIC_COMPUTATION_REJECTED") from exc
            unit = ("base" if operation["operation"] == "executed_volume_delta"
                    else "quote" if operation["operation"] == "wall_notional"
                    else "mixed" if operation["operation"] in
                    ("tape_velocity_metrics", "flow_window_metrics", "wall_turnover_ratios",
                     "orderflow_volume_metrics", "aggregate_orderflow")
                    else "quote/base")
            results.append({"operation": operation["operation"], "unit": unit, "value": value})
    # JSON roundtrip detaches nested caller-owned DTOs from the response.
    snapshot = json.loads(canonical)
    return {"schema": RESULT, "algorithm_version": "math.market.v1",
            "numeric_policy": {"number": "Decimal", "precision": 96, "rounding": "ROUND_HALF_UP"},
            "request_sha256": sha256(canonical).hexdigest(),
            "source": snapshot["source"], "results": results,
            "provenance": "CALLER_SUPPLIED_UNATTESTED", "execution_authority": False,
            "trading_authorized": False}
