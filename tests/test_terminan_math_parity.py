"""Parity against the frozen Terminan level and footprint source."""
from decimal import Decimal, localcontext
from hashlib import sha256
from pathlib import Path
from random import Random
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))
import market_compute_api as api

TERMINAN_HEAD = "d129840274f6a0faa1591a0ac3a5b92cc0bb5d88"
TERMINAN_BLOBS = {
    "levels": "de64f36cc03eca61054e1a79b9a2c1bf1481b627",
    "contracts": "1cd11250594faa5d80d1c8ee5f9244afa9097bba",
}


def oracle(module):
    source = subprocess.check_output(
        ["git", "--no-replace-objects", "-C", str(ROOT / "reference-terminan"),
         "show", f"{TERMINAN_HEAD}:terminan/{module}.py"], timeout=15)
    blob = subprocess.check_output(["git", "hash-object", "--stdin"],
                                   input=source, timeout=15).decode().strip()
    if blob != TERMINAN_BLOBS[module]:
        raise ValueError("Terminan oracle blob mismatch")
    namespace = {}
    exec(compile(source, f"<pinned-terminan-{module}>", "exec"), namespace)
    return namespace


class TerminanMathParity(unittest.TestCase):
    def test_timeframe_levels_match_exact_legacy_rows(self):
        levels = oracle("levels")
        for timeframe, period in levels["PERIODS"].items():
            candles = [
                {"t": 3*period, "h": 50, "l": 1},
                {"t": 0, "h": "1.2", "l": "1.0"},
                {"t": period, "h": "1.0999999999999999", "l": "1.01"},
                {"t": 2*period, "h": 1.1, "l": 1.01},
                {"t": 2*period, "h": 2, "l": 1.02, "complete": False},
                {"t": 2*period, "h": 1.15, "l": 1.03},
            ]
            for tick in (0, 0.1):
                for as_of in (0, 2*period-1, 2*period, 3*period):
                    for cap in (1, 3, 200):
                        with self.subTest(timeframe=timeframe, tick=tick, as_of=as_of, cap=cap):
                            kwargs = {"tick_size": tick, "max_levels": cap}
                            self.assertEqual(
                                api.untouched_timeframe_levels(candles, timeframe, as_of, **kwargs),
                                levels["untouched_levels"](candles, timeframe, as_of, **kwargs),
                            )

    def test_seeded_level_history_matches_legacy_order_and_tolerance(self):
        previous = oracle("levels")["untouched_levels"]
        rng = Random(91)
        period = 3600000
        for case in range(64):
            candles = []
            for step in range(rng.randrange(1, 50)):
                low = rng.randrange(1, 70) / 10
                candles.append({"t": step * period, "l": low,
                                "h": low + rng.randrange(0, 31) / 10,
                                "complete": rng.randrange(4) != 0})
            rng.shuffle(candles)
            as_of = rng.randrange(len(candles) + 1) * period
            kwargs = {"tick_size": rng.choice((0, 0.1, 0.25)), "max_levels": rng.randrange(1, 60)}
            with self.subTest(case=case):
                self.assertEqual(
                    api.untouched_timeframe_levels(candles, "1h", as_of, **kwargs),
                    previous(candles, "1h", as_of, **kwargs),
                )

    def test_nonfinite_levels_and_tick_refuse(self):
        for bad in ("nan", "inf", "-inf"):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                api.untouched_timeframe_levels([{"t": 0, "h": bad, "l": 1}], "1h", 3600000)
            with self.subTest(tick=bad), self.assertRaises(ValueError):
                api.untouched_timeframe_levels([], "1h", 3600000, tick_size=bad)

    def test_poc_volume_priority_does_not_round_in_caller_context(self):
        low, high = Decimal("10"), Decimal("11")
        profile = {low: Decimal("1.00001"), high: Decimal("1.00002")}
        with localcontext() as ctx:
            ctx.prec = 5
            self.assertEqual(api.volume_profile_poc(profile), high)
            self.assertEqual(api.volume_profile_poc(profile, close=low), high)

    def test_footprint_poc_uses_max_per_price_and_existing_selector(self):
        contracts = oracle("contracts")
        rows = [
            {"t": 1, "price": 14, "volume": 4},
            {"t": 1, "price": 14, "volume": 4},
            {"t": 1, "price": 12, "volume": 5},
            {"t": 1, "price": 13, "volume": 5},
            {"t": 2, "price": 15, "volume": 0},
            {"t": 2, "price": 12, "volume": 0},
        ]
        for minute in contracts["aggregate_footprint"](rows):
            profile = {}
            for row in minute["levels"]:
                price, volume = (Decimal(str(float(row[key]))) for key in ("price", "volume"))
                profile[price] = max(profile.get(price, Decimal(0)), volume)
            request = {
                "schema": api.SCHEMA, "execution_authority": False,
                "source": {"snapshot_sha256": sha256(b"offline fixture").hexdigest(),
                           "as_of_ms": 3600000,
                           "units": {"price": "quote/base", "volume": "base"}},
                "operations": [{"operation": "volume_profile_poc",
                                "input": {"close": None, "profile": [
                                    {"price": str(p), "volume": str(v)}
                                    for p, v in profile.items()]}}],
            }
            result = api.compute_batch(request)
            self.assertEqual(float(result["results"][0]["value"]), minute["poc"])
            self.assertEqual(float(profile[Decimal(result["results"][0]["value"])]),
                             minute["poc_volume"])
