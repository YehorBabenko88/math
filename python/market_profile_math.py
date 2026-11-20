"""Pure Decimal market analytics migrated from Meta Analyse.

Preserves the source-defined HALF_UP tick bucket and explicit POC tie policies.
Does not ingest market data, run strategies, or assign trading authority.
"""
from collections.abc import Mapping
from decimal import Context, Decimal, Inexact, MAX_EMAX, MIN_EMIN, ROUND_HALF_EVEN
from math import isfinite
import math


def _positive_finite_decimal(value, *, zero_allowed=False):
    if not isinstance(value, Decimal) or not value.is_finite() or (
        value < 0 if zero_allowed else value <= 0
    ):
        raise ValueError("finite Decimal required")
    return value


_PRICE_BUCKET_MAX_DIGITS = 128
_PRICE_BUCKET_MAX_ABS_EXPONENT = 1000


def price_bucket(price: Decimal, tick: Decimal, *, rounding="half_up") -> Decimal:
    """Round to a tick exactly, preserving its exponent (default HALF_UP).

    Positive finite operands accept up to 128 coefficient digits and an
    exponent from -1000 through 1000. Wider inputs raise ValueError before
    any integer scaling. The caller's Decimal context is unused. Explicit
    half_even preserves the data-builder tie rule without another kernel.
    """
    if type(rounding) is not str or rounding not in ("half_up", "half_even"):
        raise ValueError("unsupported price bucket rounding")
    price_parts = _positive_finite_decimal(price).as_tuple()
    tick_parts = _positive_finite_decimal(tick).as_tuple()
    for parts in (price_parts, tick_parts):
        if (len(parts.digits) > _PRICE_BUCKET_MAX_DIGITS
                or abs(parts.exponent) > _PRICE_BUCKET_MAX_ABS_EXPONENT):
            raise ValueError("price bucket Decimal outside supported domain")

    numerator = int(Decimal((0, price_parts.digits, 0)))
    tick_coefficient = int(Decimal((0, tick_parts.digits, 0)))
    denominator = tick_coefficient
    shift = price_parts.exponent - tick_parts.exponent
    if shift >= 0:
        numerator *= 10**shift
    else:
        denominator *= 10**-shift

    ticks, remainder = divmod(numerator, denominator)
    if (2 * remainder > denominator
            or 2 * remainder == denominator and (rounding == "half_up" or ticks % 2)):
        ticks += 1
    digits = Decimal(ticks * tick_coefficient).as_tuple().digits
    return Decimal((0, digits, tick_parts.exponent))


def volume_profile_poc(profile: dict[Decimal, Decimal], *, close: Decimal | None = None, tie_policy=None):
    """Executed-volume POC: nearest close/lowest price, or explicit first-seen ties.

    The Meta Minute (close provided) raises on an empty profile; the footprint\n    (close omitted) returns None. Reject ambiguous non-Decimal quantities.
    """
    if tie_policy not in (None, "first_seen") or tie_policy is not None and close is not None:
        raise ValueError("incompatible POC tie policy")
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
        if tie_policy == "first_seen":
            return max(profile, key=profile.get)
        return min(profile, key=lambda price: (profile[price].copy_negate(), price))
    highest_volume = max(profile.values())
    lower = upper = None
    for price, volume in profile.items():
        if volume != highest_volume:
            continue
        if price == close:
            return price
        if price < close:
            if lower is None or price > lower:
                lower = price
        elif upper is None or price < upper:
            upper = price
    if lower is None:
        return upper
    if upper is None:
        return lower
    return _nearest_bracket_price(lower, upper, close)


def _subtract_nearby(high, low):
    # The adjusted exponents are at most one apart. Aligning the coefficients
    # needs at most one extra digit, regardless of the absolute exponent.
    precision = max(len(high.as_tuple().digits), len(low.as_tuple().digits)) + 2
    exact = Context(prec=precision, Emin=MIN_EMIN, Emax=MAX_EMAX, traps=[Inexact])
    return exact.subtract(high, low)


def _nearest_bracket_price(lower, upper, close):
    # Upper wins only when (upper - close) + lower < close. Avoid constructing
    # an exact sum over arbitrary exponent gaps: compare magnitudes first.
    if upper.adjusted() > close.adjusted() + 1:
        return lower
    upper_gap = _subtract_nearby(upper, close)
    larger = max(upper_gap, lower)
    if larger >= close:
        return lower
    if larger.adjusted() < close.adjusted() - 1:
        return upper
    remaining = _subtract_nearby(close, larger)
    return upper if min(upper_gap, lower) < remaining else lower


def _market_amount(value):
    """Bound exact accumulated quantities/products before exponent alignment."""
    if not isinstance(value, Decimal) or not value.is_finite():
        raise ValueError("MARKET_DECIMAL_DOMAIN")
    parts = value.as_tuple()
    if (len(parts.digits) > 4270 or abs(parts.exponent) > 2000
            or value and value.copy_abs().adjusted() > 2262):
        raise ValueError("MARKET_DECIMAL_DOMAIN")
    return value


def _market_context():
    # Bounded product/accumulator exponent span is at most 4263 digits.
    # 4300 retains exact sums/differences, including up to one million inputs.
    return Context(prec=4300, Emin=MIN_EMIN, Emax=MAX_EMAX, traps=[Inexact])


def _market_ratio(numerator, denominator, precision=28):
    if type(precision) is not int or precision not in (28, 96):
        raise ValueError("INVALID_RATIO_POLICY")
    return Context(prec=precision, rounding=ROUND_HALF_EVEN, Emin=MIN_EMIN,
                   Emax=MAX_EMAX, traps=[]).divide(numerator, denominator)


def exact_sum(values):
    """One-pass signed exact market-amount sum; <=1M bounded finite inputs.

    Inputs/results have <=4270 coefficient digits, exponent -2000..2000,
    adjusted magnitude <=2262. These bounds admit exact products of the
    128-digit/-1000..1000 market inputs and bounded accumulated quantities.
    No source trust or execution authority is conferred.
    """
    result = Decimal(0)
    exact = _market_context()
    try:
        source = iter(values)
    except TypeError as exc:
        raise ValueError("INVALID_MARKET_AMOUNTS") from exc
    for count, value in enumerate(source, 1):
        if count > MAX_STREAM_EVENTS:
            raise ValueError("MARKET_AMOUNT_LIMIT")
        result = exact.add(result, _market_amount(value))
    return _market_amount(result)


def wall_notional(price: Decimal, size: Decimal) -> Decimal:
    """Exact bounded notional; book membership/lifetime stay caller-owned."""
    _orderflow_decimal(_positive_finite_decimal(price))
    _orderflow_decimal(_positive_finite_decimal(size, zero_allowed=True))
    return _market_context().multiply(price, size)


def minute_volume_update(volume, quote_volume, buy_volume, sell_volume,
                         bucket_volume, price, size, side):
    """Pure five-total minute/profile update; DTO/time/OHLC remain caller-owned.

    Returns (volume, quote_volume, buy_volume, sell_volume, bucket_volume).
    Buy/1 and Sell/2 aliases are classified; other bounded strings are unknown.
    All operands are checked before any result is returned; no inputs mutate.
    """
    if type(side) is not str or len(side) > 16:
        raise ValueError("INVALID_MARKET_SIDE")
    prior = (volume, quote_volume, buy_volume, sell_volume, bucket_volume)
    for value in prior:
        _positive_finite_decimal(_market_amount(value), zero_allowed=True)
    amount = wall_notional(price, size)
    side = side.lower()
    return (exact_sum((volume, size)), exact_sum((quote_volume, amount)),
            exact_sum((buy_volume, size)) if side in ("buy", "1") else buy_volume,
            exact_sum((sell_volume, size)) if side in ("sell", "2") else sell_volume,
            exact_sum((bucket_volume, size)))


def footprint_cell_update(buy, sell, quantity, taker_side):
    """Exact executed-volume cell update; counters/provenance stay caller-owned."""
    for value in (buy, sell):
        _positive_finite_decimal(_market_amount(value), zero_allowed=True)
    _orderflow_decimal(_positive_finite_decimal(quantity, zero_allowed=True))
    if taker_side not in ("Buy", "Sell"):
        raise ValueError("invalid taker side")
    return (exact_sum((buy, quantity)), sell) if taker_side == "Buy" else (buy, exact_sum((sell, quantity)))


def executed_volume_delta(buy: Decimal, sell: Decimal) -> Decimal:
    """Exact signed taker delta; does not classify side or trust continuity."""
    for value in (buy, sell):
        _positive_finite_decimal(_market_amount(value), zero_allowed=True)
    return exact_sum((buy, sell.copy_negate()))


def tick_distance(price, level_price, tick_size, *, ratio_precision=28):
    """Absolute tick distance, finite 28-digit HALF_EVEN ratio policy."""
    for value in (price, level_price, tick_size):
        _orderflow_decimal(_positive_finite_decimal(value))
    gap = _market_context().subtract(price, level_price).copy_abs()
    return _market_ratio(gap, tick_size, ratio_precision)


def within_tick_distance(price, level_price, tick_size, proximity_ticks):
    """Exact proximity predicate; a rounded display ratio cannot admit data."""
    for value in (price, level_price, tick_size):
        _orderflow_decimal(_positive_finite_decimal(value))
    _orderflow_decimal(_positive_finite_decimal(proximity_ticks, zero_allowed=True))
    exact = _market_context()
    return exact.subtract(price, level_price).copy_abs() <= exact.multiply(tick_size, proximity_ticks)


def book_summary_metrics(bids, asks, tick):
    """Pure bounded book arithmetic; caller must qualify sequence/source.

    Returns (best_bid, best_ask, spread, bid_notional, ask_notional).
    Missing sides have None best price/spread; crossed books are refused.
    """
    _orderflow_decimal(_positive_finite_decimal(tick))
    if any(type(side) is not dict or len(side) > MAX_STREAM_BUCKETS for side in (bids, asks)):
        raise ValueError("INVALID_BOOK_LEVELS")
    amounts = []
    for side in (bids, asks):
        amounts.append(exact_sum(wall_notional(price, size) for price, size in side.items()))
    bid, ask = max(bids, default=None), min(asks, default=None)
    if bid is not None and ask is not None and bid >= ask:
        raise ValueError("CROSSED_BOOK")
    spread = _market_context().subtract(ask, bid) if bid is not None and ask is not None else None
    return bid, ask, spread, *amounts


def tape_velocity_metrics(events, level_price: Decimal, tick_size: Decimal,
                          window_ms: int, proximity_ticks: Decimal, now_ms: int,
                          *, observed_price: Decimal | None = None, ratio_precision=28):
    """Exact tape quantities; rates/distances use 28-digit HALF_EVEN ratios."""
    for value in (level_price, tick_size):
        _orderflow_decimal(_positive_finite_decimal(value))
    _orderflow_decimal(_positive_finite_decimal(proximity_ticks, zero_allowed=True))
    if (type(window_ms) is not int or not 0 < window_ms <= 2**63-1
            or type(now_ms) is not int or not 0 <= now_ms <= 2**63-1):
        raise ValueError("invalid tape window")
    if not isinstance(events, (tuple, list)) or len(events) > MAX_STREAM_EVENTS:
        raise ValueError("invalid tape events")
    buys = sells = Decimal(0)
    count = 0
    exact = _market_context()
    for timestamp_ms, price, quantity, side in events:
        if type(timestamp_ms) is not int or timestamp_ms < now_ms-window_ms or timestamp_ms > now_ms:
            raise ValueError("invalid tape timestamp")
        amount = wall_notional(price, quantity)
        if side not in ("Buy", "Sell"):
            raise ValueError("invalid tape side")
        # Compare exact quantities, never a rounded distance at a boundary.
        if within_tick_distance(price, level_price, tick_size, proximity_ticks):
            count += 1
            if side == "Buy":
                buys = exact_sum((buys, amount))
            else:
                sells = exact_sum((sells, amount))
    seconds = exact.divide(Decimal(window_ms), Decimal(1000))
    distance = None if observed_price is None else tick_distance(observed_price, level_price, tick_size, ratio_precision=ratio_precision)
    return (_market_ratio(Decimal(count), seconds, ratio_precision),
            _market_ratio(exact_sum((buys, sells)), seconds, ratio_precision), buys, sells, distance)


def flow_window_metrics(events, now_ms: int, window_seconds: int, *, ratio_precision=28):
    """Pure exact RollingFlow metrics. Input: (time_ms, notional, side)."""
    if (type(now_ms) is not int or not 0 <= now_ms <= 2**63-1
            or type(window_seconds) is not int or not 0 < window_seconds <= 2**63-1):
        raise ValueError("invalid flow window")
    if not isinstance(events, (tuple, list)) or len(events) > MAX_STREAM_EVENTS:
        raise ValueError("invalid flow events")
    buys = sells = total = Decimal(0)
    count = 0
    for timestamp_ms, notional, side in events:
        if type(timestamp_ms) is not int or timestamp_ms < 0 or type(side) is not str:
            raise ValueError("invalid flow event")
        _positive_finite_decimal(_market_amount(notional), zero_allowed=True)
        if not 0 <= now_ms-timestamp_ms <= window_seconds*1000:
            continue
        count += 1
        total = exact_sum((total, notional))
        if side in ("buy", "1"):
            buys = exact_sum((buys, notional))
        elif side in ("sell", "2"):
            sells = exact_sum((sells, notional))
    return {"turnover_usd": total, "trades": count, "buy_usd": buys,
            "sell_usd": sells, "trades_per_second": _market_ratio(Decimal(count), Decimal(window_seconds), ratio_precision)}


def wall_turnover_ratios(price: Decimal, size: Decimal, turnovers, *, ratio_precision=28):
    """Pure fixed-policy wall ratios; unknown source stays unverified."""
    amount = wall_notional(price, size)
    if not isinstance(turnovers, dict) or len(turnovers) > MAX_STREAM_BUCKETS:
        raise ValueError("invalid turnovers")
    return {"wall_usd": amount,
            "ratios": {window: _market_ratio(amount, max(Decimal(1), _positive_finite_decimal(_market_amount(total), zero_allowed=True)), ratio_precision)
                       for window,total in turnovers.items()},
            "observed_turnover": turnovers.copy()}


def historical_aggregate_integrity(row):
    """Historical binary64 partition/POC integrity; never source authentication.

    Preserves the source-defined math.isclose default rel_tol=1e-9 and
    abs_tol=1e-9 quantity checks, plus <=8*max(ulp(a),ulp(b)) price bounds.
    JSON byte caps, event time and provenance remain consumer-owned.
    """
    try:
        def number(v):return type(v) in (int,float) and math.isfinite(v)
        def boundary_equal(a,b):return abs(a-b)<=8*max(math.ulp(float(a)),math.ulp(float(b)))
        values=[row[k] for k in ('open','high','low','close','buy_volume','sell_volume','delta','poc_price')]
        if not all(number(v) for v in values):return False
        # ULP tolerance applies only inside the strictly positive price domain.
        # Subnormal rounding must never admit zero/negative market prices.
        if row['poc_price']<=0:return False
        if min(row['buy_volume'],row['sell_volume'])<0:return False
        if not 0 < row['low'] <= min(row['open'],row['close']) <= max(row['open'],row['close']) <= row['high']:return False
        if type(row['trade_count']) is not int or row['trade_count']<=0:return False
        levels=row['levels']
        if not isinstance(levels,list) or not 0<len(levels)<=10000:return False
        prices=set();buy=sell=trades=0
        for x in levels:
            if not all(number(x[k]) for k in ('price','buy_volume','sell_volume','delta','volume')):return False
            if x['price']<=0:return False
            if x['price'] in prices or not ((x['price']>=row['low'] or boundary_equal(x['price'],row['low'])) and (x['price']<=row['high'] or boundary_equal(x['price'],row['high']))):return False
            prices.add(x['price'])
            if min(x['buy_volume'],x['sell_volume'],x['volume'])<0:return False
            if not math.isclose(x['delta'],x['buy_volume']-x['sell_volume'],abs_tol=1e-9) or not math.isclose(x['volume'],x['buy_volume']+x['sell_volume'],abs_tol=1e-9):return False
            if any(type(x[k]) is not int or x[k]<0 for k in ('buy_count','sell_count')):return False
            buy+=x['buy_volume'];sell+=x['sell_volume'];trades+=x['buy_count']+x['sell_count']
        return (trades==row['trade_count'] and row['poc_price'] in prices and
                any(x['price']==row['poc_price'] and math.isclose(x['volume'],max(v['volume'] for v in levels),abs_tol=1e-9) for x in levels) and
                math.isclose(buy,row['buy_volume'],abs_tol=1e-9) and math.isclose(sell,row['sell_volume'],abs_tol=1e-9) and
                math.isclose(buy-sell,row['delta'],abs_tol=1e-9))
    except (KeyError,TypeError,ValueError,OverflowError):return False

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
    return _untouched_price_sweep(normalized)


def _untouched_price_sweep(candles, tick_size=None):
    active = {}
    for start, high, low in candles:
        for key, level in list(active.items()):
            side, price, _ = level
            observed = high if side == "high" else low
            boundary = price
            if tick_size is not None:
                boundary = price - tick_size if side == "high" else price + tick_size
            touched = observed >= boundary if side == "high" else observed <= boundary
            if touched:
                del active[key]
        active[("high", high)] = ("high", high, start)
        active[("low", low)] = ("low", low, start)
    return tuple(active.values())


_LEVEL_PERIOD_MS = {"1h": 3600000, "4h": 14400000, "1d": 86400000, "1w": 604800000}


def _finite_level_number(value):
    if type(value) not in (int, float, Decimal, str):
        raise ValueError("invalid level number")
    try:
        number = float(value)
    except (ValueError, OverflowError) as exc:
        raise ValueError("invalid level number") from exc
    if not isfinite(number):
        raise ValueError("invalid level number")
    return number


def untouched_timeframe_levels(candles, timeframe, as_of_ms, *, tick_size=0, max_levels=200):
    """Compute levels from up to 20,000 caller-qualified t/h/l candles.

    t and as_of_ms are nonnegative integer UTC epoch milliseconds in int64.
    h, l and tick_size are finite binary64 values after conversion from int,
    float, Decimal or numeric string. complete must be Boolean when present.
    Missing complete retains legacy behavior. Incomplete candles and candles
    closing after as_of_ms are excluded. Source and coverage are caller-owned.
    """
    if (type(timeframe) is not str or timeframe not in _LEVEL_PERIOD_MS
            or type(as_of_ms) is not int or not 0 <= as_of_ms < 2**63
            or type(max_levels) is not int or not 1 <= max_levels <= 2000):
        raise ValueError("invalid level parameters")
    if not isinstance(candles, (list, tuple)) or len(candles) > 20000:
        raise ValueError("invalid candle collection")
    period = _LEVEL_PERIOD_MS[timeframe]
    tick_size = _finite_level_number(tick_size)
    if tick_size < 0:
        raise ValueError("invalid tick size")
    normalized = []
    for candle in candles:
        if not isinstance(candle, Mapping) or not {"t", "h", "l"} <= candle.keys():
            raise ValueError("invalid candle")
        start = candle["t"]
        complete = candle.get("complete", True)
        if type(start) is not int or not 0 <= start < 2**63 or type(complete) is not bool:
            raise ValueError("invalid candle time or completion")
        high = _finite_level_number(candle["h"])
        low = _finite_level_number(candle["l"])
        if high < low:
            raise ValueError("invalid candle range")
        if complete and start + period <= as_of_ms:
            normalized.append((start, high, low))
    normalized.sort(key=lambda row: row[0])
    active = _untouched_price_sweep(normalized, tick_size)
    # The legacy response groups surviving older levels by side before adding
    # the newest high/low pair and clipping to max_levels.
    survivors, latest = active[:-2], active[-2:]
    ordered = sorted(survivors, key=lambda level: level[0]) + list(latest)
    return [
        {"timeframe": timeframe, "side": side, "price": price,
         "origin_ms": start, "confirmed_ms": start + period}
        for side, price, start in ordered[-max_levels:]
    ]


# Two independent limits: the existing fixed-size batch contract stays at
# 20,000 rows; the explicit streaming contract may consume a larger bounded
# iterator but retains no raw event history and at most 20,000 bucket states.
MAX_ORDERFLOW_BATCH = 20_000
MAX_STREAM_EVENTS = 1_000_000
MAX_STREAM_BUCKETS = 20_000


def _orderflow_decimal(value):
    """Bound input before exponent alignment, including signed initial delta."""
    if not isinstance(value, Decimal) or not value.is_finite():
        raise ValueError("ORDERFLOW_DECIMAL_DOMAIN")
    parts = value.as_tuple()
    if len(parts.digits) > 128 or abs(parts.exponent) > 1000:
        raise ValueError("ORDERFLOW_DECIMAL_DOMAIN")
    return value


def _orderflow_context():
    # Aligned inputs require at most 128 + 2*1000 digits. One million
    # events and the initial delta add at most seven digits. All sums and
    # differences fit exactly; Inexact is a fail-closed internal invariant.
    return Context(prec=2140, Emin=MIN_EMIN, Emax=MAX_EMAX, traps=[Inexact])


def _orderflow_price_floor(price, tick):
    """Exact positive FLOOR index; never round the quotient before flooring."""
    p, t = price.as_tuple(), tick.as_tuple()
    numerator = int(Decimal((0, p.digits, 0)))
    coefficient = int(Decimal((0, t.digits, 0)))
    denominator = coefficient
    shift = p.exponent - t.exponent
    if shift >= 0:
        numerator *= 10**shift
    else:
        denominator *= 10**-shift
    units = numerator // denominator
    return Decimal((0, Decimal(units * coefficient).as_tuple().digits, t.exponent))


def _new_orderflow_totals():
    return [Decimal(0), Decimal(0), Decimal(0), 0]


def _accumulate_orderflow(totals, price, volume, side, exact):
    """The one shared per-trade arithmetic for batch and streaming modes."""
    _positive_finite_decimal(price)
    _positive_finite_decimal(volume, zero_allowed=True)
    _orderflow_decimal(price)
    _orderflow_decimal(volume)
    if side == "buy":
        totals[0] = exact.add(totals[0], volume)
    elif side == "sell":
        totals[1] = exact.add(totals[1], volume)
    elif side == "unknown":
        totals[2] = exact.add(totals[2], volume)
    else:
        raise ValueError("unsupported trade side")
    totals[3] += 1


def _finish_orderflow(totals, initial_delta, exact):
    buy, sell, unknown, count = totals
    delta = exact.subtract(buy, sell)
    classified = exact.add(buy, sell)
    # A dimensionless ratio can repeat forever. Fix its public policy at
    # 28 significant digits, HALF_EVEN, independently of caller traps.
    ratio = Context(prec=28, rounding=ROUND_HALF_EVEN, Emin=MIN_EMIN,
                    Emax=MAX_EMAX, traps=[])
    return {"buy_volume": buy, "sell_volume": sell, "unknown_volume": unknown,
            "delta": delta, "cumulative_delta": exact.add(initial_delta, delta),
            "imbalance": ratio.divide(delta, classified) if classified else None,
            "trade_count": count}


def orderflow_volume_metrics(trades, initial_delta: Decimal = Decimal(0)):
    """Pure Meta orderflow_metrics.calculate arithmetic including unknown volume.

    Preserves the original bounded batch contract: at most 20,000 trade rows.
    """
    if not isinstance(initial_delta, Decimal) or not initial_delta.is_finite():
        raise ValueError("invalid initial delta")
    _orderflow_decimal(initial_delta)
    if not isinstance(trades, (tuple, list)) or len(trades) > MAX_ORDERFLOW_BATCH:
        raise ValueError("invalid trade batch")
    totals = _new_orderflow_totals()
    exact = _orderflow_context()
    for item in trades:
        if not isinstance(item, (tuple, list)) or len(item) != 3:
            raise ValueError("invalid trade")
        _accumulate_orderflow(totals, *item, exact)
    return _finish_orderflow(totals, initial_delta, exact)


def aggregate_orderflow_stream(trades, *, mode: str,
                               interval_ms: int | None = None,
                               tick_size: Decimal | None = None,
                               initial_delta: Decimal = Decimal(0)):
    """One-pass bounded-memory aggregation of a generator or finite iterable.

    Never materializes trade rows. Memory O(unique bucket count), strictly
    <=20,000 bucket states, independent of the number of input trades.
    Bucket keys are sorted after the stream ends. Volumes, deltas and price
    FLOOR bins are exact, independent of caller precision/traps. Decimal
    inputs accept <=128 coefficient digits and exponents -1000..1000.
    Imbalance uses 28 significant digits, HALF_EVEN (None if unclassified).
    Interleaved/late buckets retain the same exact totals.
    """
    if type(mode) is not str or mode not in ("time", "price"):
        raise ValueError("INVALID_AGGREGATE_MODE")
    if not isinstance(initial_delta, Decimal) or not initial_delta.is_finite():
        raise ValueError("INVALID_INITIAL_DELTA")
    _orderflow_decimal(initial_delta)
    exact = _orderflow_context()
    if mode == "time":
        if type(interval_ms) is not int or interval_ms <= 0:
            raise ValueError("INVALID_INTERVAL_MS")
    else:
        _positive_finite_decimal(tick_size)
        _orderflow_decimal(tick_size)
    try:
        source = iter(trades)
    except TypeError as exc:
        raise ValueError("INVALID_AGGREGATE_STREAM") from exc
    buckets = {}
    count = 0
    for entry in source:
        count += 1
        if count > MAX_STREAM_EVENTS:
            raise ValueError("STREAM_EVENT_LIMIT")
        if not isinstance(entry, (list, tuple)) or len(entry) != 4:
            raise ValueError("INVALID_AGGREGATE_TRADE")
        ts, price, volume, side = entry
        if type(ts) is not int or ts < 0:
            raise ValueError("INVALID_TRADE_CLOCK")
        _positive_finite_decimal(price)
        _positive_finite_decimal(volume, zero_allowed=True)
        _orderflow_decimal(price)
        _orderflow_decimal(volume)
        # Keep the original Meta grouping semantics: epoch-floor by timestamp
        # or ROUND_FLOOR price index. Never normalize price into HALF_UP bins.
        key = (ts // interval_ms * interval_ms if mode == "time" else
               _orderflow_price_floor(price, tick_size))
        totals = buckets.get(key)
        if totals is None:
            if len(buckets) >= MAX_STREAM_BUCKETS:
                raise ValueError("STREAM_BUCKET_LIMIT")
            totals = _new_orderflow_totals()
            buckets[key] = totals
        _accumulate_orderflow(totals, price, volume, side, exact)
    cumulative = initial_delta
    output = []
    for key in sorted(buckets):
        metrics = _finish_orderflow(buckets[key], cumulative, exact)
        cumulative = metrics["cumulative_delta"]
        output.append((key, metrics))
    return tuple(output)


def aggregate_orderflow(trades, *, mode: str, interval_ms: int | None = None,
                        tick_size: Decimal | None = None,
                        initial_delta: Decimal = Decimal(0)):
    """Legacy bounded batch API; do not weaken its 20,000-row admission."""
    if not isinstance(trades, (list, tuple)) or len(trades) > MAX_ORDERFLOW_BATCH:
        raise ValueError("INVALID_AGGREGATE_BATCH")
    return aggregate_orderflow_stream(trades, mode=mode, interval_ms=interval_ms,
                                      tick_size=tick_size, initial_delta=initial_delta)


def large_liquidity_levels(bids, asks, level_price: Decimal, tick_size: Decimal,
                           *, min_notional=Decimal("100000"),
                           min_relative=Decimal("5"),
                           max_distance_ticks=Decimal("50")):
    """Math part of Meta liquidity.large_levels; caller owns book validity/provenance."""
    _positive_finite_decimal(level_price)
    _positive_finite_decimal(tick_size)
    _positive_finite_decimal(min_notional, zero_allowed=True)
    _positive_finite_decimal(min_relative, zero_allowed=True)
    _positive_finite_decimal(max_distance_ticks, zero_allowed=True)
    if not isinstance(bids, dict) or not isinstance(asks, dict) or len(bids)+len(asks)>4096:
        raise ValueError("INVALID_LIQUIDITY_BOOK")
    entries = []
    for side, levels in (("bid", bids), ("ask", asks)):
        for price, size in levels.items():
            _positive_finite_decimal(price)
            _positive_finite_decimal(size, zero_allowed=True)
            entries.append((side, price, price*size))
    amounts = sorted(amount for _,_,amount in entries if amount>0)
    if not amounts:
        return ()
    mid=len(amounts)//2
    median=amounts[mid] if len(amounts)%2 else (amounts[mid-1]+amounts[mid])/2
    if median<=0:
        return ()
    results=[]
    for side,price,amount in entries:
        distance=abs(price-level_price)/tick_size
        relative=amount/median
        if amount>=min_notional and relative>=min_relative and distance<=max_distance_ticks:
            results.append((side,price,amount,distance,relative))
    return tuple(sorted(results,key=lambda value:(value[3],-value[2])))
