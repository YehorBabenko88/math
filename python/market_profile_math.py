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

    Return None only for an empty profile; reject ambiguous non-Decimal quantities.
    """
    if not isinstance(profile, dict):
        raise ValueError("volume profile must be a dict")
    if close is not None:
        _positive_finite_decimal(close)
    if not profile:
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
