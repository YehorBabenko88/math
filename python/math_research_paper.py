"""PROVISIONAL_ABI DEV_CANDIDATE: causal admission seam for existing Math paper kernel.
Not an ABI approval, source attestation, or independent acceptance oracle.
"""
from dataclasses import dataclass
from decimal import Decimal
from market_math import paper_quote_metrics

@dataclass(frozen=True)
class Observation:
    event_ms: int
    available_ms: int
    price: Decimal

@dataclass(frozen=True)
class Funding:
    event_ms: int
    available_ms: int
    mark: Decimal
    rate: Decimal


def _time(value):
    if type(value) is not int or value < 0:
        raise ValueError('INVALID_TIME')
    return value


def evaluate_closed_quote(*, side, entry, exit, decision_ms, as_of_ms,
                          notional, fee_bps, slippage_bps, funding,
                          funding_status, coverage_status, decision_features):
    """Caller must independently qualify coverage; never grants authority.

    Draft assumes funding at entry excluded, at exit included; A/U must
    confirm boundary convention. A result is descriptive only.
    """
    # Provisional local DTO: features are observations, not fill prices.
    # Strictly before decision; equality is deliberately refused pending A.
    _time(decision_ms)
    if type(decision_features) is not tuple or not 1 <= len(decision_features) <= 256:
        raise ValueError('INVALID_DECISION_FEATURES')
    for feature in decision_features:
        if type(feature) is not Observation:
            raise ValueError('INVALID_DECISION_FEATURE')
        _time(feature.event_ms); _time(feature.available_ms)
        if not feature.event_ms <= feature.available_ms < decision_ms:
            raise ValueError('LOOK_AHEAD_FEATURE')
        if type(feature.price) is not Decimal or not feature.price.is_finite():
            raise ValueError('INVALID_FEATURE_VALUE')
    if type(coverage_status) is not str or type(funding_status) is not str or coverage_status != 'COMPLETE' or funding_status != 'COMPLETE':
        raise ValueError('UNQUALIFIED_COVERAGE')
    if type(entry) is not Observation or type(exit) is not Observation:
        raise ValueError('INVALID_OBSERVATION')
    for t in (decision_ms, as_of_ms, entry.event_ms, entry.available_ms,
              exit.event_ms, exit.available_ms):
        _time(t)
    if not (decision_ms <= entry.event_ms < exit.event_ms <= as_of_ms and
            entry.event_ms <= entry.available_ms <= as_of_ms and
            exit.event_ms <= exit.available_ms <= as_of_ms):
        raise ValueError('NONCAUSAL_QUOTE')
    if type(funding) is not tuple or len(funding) > 128:
        raise ValueError('INVALID_FUNDING_SEQUENCE')
    previous = entry.event_ms
    selected = []
    for row in funding:
        if type(row) is not Funding:
            raise ValueError('INVALID_FUNDING_EVENT')
        _time(row.event_ms); _time(row.available_ms)
        if not (previous < row.event_ms <= exit.event_ms and
                row.event_ms <= row.available_ms <= as_of_ms):
            raise ValueError('NONCAUSAL_FUNDING')
        previous = row.event_ms
        selected.append((row.mark, row.rate))
    return paper_quote_metrics(side, entry.price, exit.price, notional,
                               fee_bps, slippage_bps, tuple(selected))
