"""Canonical Math ownership of Meta Analyse's original orderbook wall lifecycle.

Source behavior: Meta Analyse original src/meta_analyse/wall_tracker.py
at b1a4d6a41054f0040a88dc80b585380fb6b4f323
(Git blob faae6e3539c8b33e9d933fce4fd2a92b518c4ac5).

This is a pure local observation/projection. A disappearing book wall is
NOT proof of spoofing, market authenticity, source completeness, executable
liquidity, exchange delisting, strategy/admission or trading authority.
No transport, SQL, service, process, or exchange client is created here.
Old Meta module is intentionally retained until consumer parity/cutover.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from market_math import wall_notional


@dataclass(frozen=True)
class WallObservation:
    price: Decimal
    side: str
    notional: Decimal
    lifetime_ms: int
    vanished_without_execution_evidence: bool
    confidence: str


class WallTracker:
    """Drop-in observational Meta API backed by canonical Math wall_notional.

    This state must be instantiated per consumer/market, not shared across
    unrelated books. Existing Meta behavior is intentionally preserved,
    including invalid/receding clock resets and the <= max_age_ms boundary.
    """

    def __init__(self, min_notional=Decimal("100000"), max_age_ms=3000):
        self.min_notional = Decimal(min_notional)
        self.max_age_ms = max_age_ms
        self.active = {}
        self.last_ts = None

    def reset(self):
        self.active.clear()
        self.last_ts = None

    def observe(self, book, received_ms: int):
        if not book.valid:
            self.reset()
            return []
        if self.last_ts is not None and received_ms < self.last_ts:
            self.reset()
            return []
        self.last_ts = received_ms
        current = {}
        for side, levels in (("bid", book.bids), ("ask", book.asks)):
            for price, size in levels.items():
                value = wall_notional(price, size)
                if value >= self.min_notional:
                    current[(side, price)] = value
        warnings = []
        for key, (first, notional) in self.active.items():
            if key not in current:
                lifetime = received_ms - first
                if lifetime <= self.max_age_ms:
                    warnings.append(WallObservation(
                        key[1], key[0], notional, lifetime, True,
                        "unverified_cancellation_or_execution"))
        self.active = {
            key: (self.active[key][0] if key in self.active else received_ms, value)
            for key, value in current.items()
        }
        return warnings
