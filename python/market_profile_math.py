"""Pure Decimal market analytics migrated from Meta Analyse.

Preserves the source-defined HALF_UP tick bucket and explicit POC tie policies.
Does not ingest market data, run strategies, or assign trading authority.
"""
from decimal import Decimal, ROUND_HALF_UP


def _positive_finite_decimal(value, *, zero_allowed=False):
    if not isinstance(value, Decimal) or not value.is_finite() or (
        value < 0 if zero_allowed else value <= 0
    ):
        raise ValueError("finite Decimal required")
    return value


def price_bucket(price: Decimal, tick: Decimal) -> Decimal:
    """ROUND_HALF_UP reproduces Meta Analyse core.price_bucket."""
    _positive_finite_decimal(price)
    _positive_finite_decimal(tick)
    return (price / tick).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * tick


def volume_profile_poc(profile: dict[Decimal, Decimal], *, close: Decimal | None = None):
    """Executed-volume POC: Meta Minute ties nearest close; footprint ties lowest price.

    The Meta Minute (close provided) raises on an empty profile; the footprint\n    (close omitted) returns None. Reject ambiguous non-Decimal quantities.
    """
    if not isinstance(profile, dict):
        raise ValueError("volume profile must be a dict")
    if close is not None:
        _positive_finite_decimal(close)
    if not profile:
        if close is not None:
            raise ValueError("empty volume profile")
        return None
    for price, volume in profile.items():
        _positive_finite_decimal(price)
        _positive_finite_decimal(volume, zero_allowed=True)
    if close is None:
        return min(profile, key=lambda price: (-profile[price], price))
    return min(profile, key=lambda price: (-profile[price], abs(price - close), price))


def executed_volume_delta(buy: Decimal, sell: Decimal) -> Decimal:
    """Pure signed taker delta; does not classify trade side or trust continuity."""
    _positive_finite_decimal(buy, zero_allowed=True)
    _positive_finite_decimal(sell, zero_allowed=True)
    return buy - sell


def tape_velocity_metrics(events, level_price: Decimal, tick_size: Decimal,
                          window_ms: int, proximity_ticks: Decimal, now_ms: int,
                          *, observed_price: Decimal | None = None):
    """Pure Meta TapeVelocity arithmetic; event ordering and gaps remain caller-owned."""
    _positive_finite_decimal(level_price)
    _positive_finite_decimal(tick_size)
    _positive_finite_decimal(proximity_ticks, zero_allowed=True)
    if type(window_ms) is not int or window_ms <= 0 or type(now_ms) is not int or now_ms < 0:
        raise ValueError("invalid tape window")
    if not isinstance(events, (tuple, list)):
        raise ValueError("invalid tape events")
    buys = sells = Decimal(0)
    count = 0
    for timestamp_ms, price, quantity, side in events:
        if type(timestamp_ms) is not int or timestamp_ms < now_ms-window_ms or timestamp_ms > now_ms:
            raise ValueError("invalid tape timestamp")
        _positive_finite_decimal(price)
        _positive_finite_decimal(quantity, zero_allowed=True)
        if side not in ("Buy", "Sell"):
            raise ValueError("invalid tape side")
        if abs(price-level_price)/tick_size <= proximity_ticks:
            count += 1
            amount = price * quantity
            if side == "Buy":
                buys += amount
            else:
                sells += amount
    seconds = Decimal(window_ms)/Decimal(1000)
    distance = None
    if observed_price is not None:
        _positive_finite_decimal(observed_price)
        distance = abs(observed_price-level_price)/tick_size
    return (Decimal(count)/seconds, (buys+sells)/seconds, buys, sells, distance)


def wall_notional(price: Decimal, size: Decimal) -> Decimal:
    """Source-owned wall arithmetic; book membership and lifetime stay with observer."""
    _positive_finite_decimal(price)
    _positive_finite_decimal(size, zero_allowed=True)
    return price*size


def flow_window_metrics(events, now_ms: int, window_seconds: int):
    """Pure Meta RollingFlow metrics. Input: (time_ms, notional, side) tuples."""
    if type(now_ms) is not int or type(window_seconds) is not int or window_seconds <= 0:
        raise ValueError("invalid flow window")
    if not isinstance(events, (tuple, list)):
        raise ValueError("invalid flow events")
    buys = sells = total = Decimal(0)
    count = 0
    for timestamp_ms, notional, side in events:
        if type(timestamp_ms) is not int:
            raise ValueError("invalid flow timestamp")
        _positive_finite_decimal(notional, zero_allowed=True)
        if not 0 <= now_ms-timestamp_ms <= window_seconds*1000:
            continue
        count += 1
        total += notional
        if side in ("buy", "1"):
            buys += notional
        elif side in ("sell", "2"):
            sells += notional
    return {"turnover_usd": total, "trades": count, "buy_usd": buys,
            "sell_usd": sells, "trades_per_second": Decimal(count)/Decimal(window_seconds)}


def wall_turnover_ratios(price: Decimal, size: Decimal, turnovers):
    """Pure Meta RollingFlow.wall_score arithmetic; unknown source stays unverified."""
    amount = wall_notional(price, size)
    if not isinstance(turnovers, dict):
        raise ValueError("invalid turnovers")
    return {"wall_usd": amount,
            "ratios": {window: amount/max(Decimal(1), _positive_finite_decimal(total, zero_allowed=True))
                       for window,total in turnovers.items()},
            "observed_turnover": turnovers.copy()}


def untouched_decimal_levels(closed_candles):
    """Meta core.untouched_levels numeric equivalence on verified CLOSED candles.

    Each item is (start_ms, high, low). Grid/Terminan must establish coverage,
    timeframe close, timestamp provenance and source authenticity separately.
    """
    if not isinstance(closed_candles, (tuple, list)):
        raise ValueError("INVALID_CANDLES")
    if len(closed_candles) > 20000:
        raise ValueError("CANDLE_LIMIT")
    normalized = []
    for candle in closed_candles:
        if not isinstance(candle, (tuple, list)) or len(candle) != 3:
            raise ValueError("INVALID_CANDLE")
        start, high, low = candle
        if type(start) is not int or start < 0 or start > 2**63-1:
            raise ValueError("INVALID_CANDLE_TIME")
        _positive_finite_decimal(high)
        _positive_finite_decimal(low)
        if high < low:
            raise ValueError("INVALID_CANDLE_RANGE")
        normalized.append((start, high, low))
    normalized.sort(key=lambda row: row[0])
    if any(a[0] == b[0] for a, b in zip(normalized, normalized[1:])):
        raise ValueError("DUPLICATE_CANDLE_TIME")
    active = {}
    for start, high, low in normalized:
        for key, level in list(active.items()):
            side, price, _ = level
            if side == "high" and high >= price or side == "low" and low <= price:
                del active[key]
        active[("high", high)] = ("high", high, start)
        active[("low", low)] = ("low", low, start)
    return tuple(active.values())
