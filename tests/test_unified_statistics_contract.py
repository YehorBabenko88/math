"""Runtime-neutral exact parity and refusal controls for Math statistics.

This test suite exercises the committed module; does not contact Grid or an exchange.
"""
import hashlib
import importlib.util
import math
from decimal import Decimal, localcontext
import subprocess
import sys
import types
from datetime import datetime, timezone, timedelta
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("math_owned_statistics", ROOT / "python/history_statistics.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
PROFILE_SPEC = importlib.util.spec_from_file_location("math_owned_market_profile", ROOT / "python/market_profile_math.py")
PROFILE = importlib.util.module_from_spec(PROFILE_SPEC)
PROFILE_SPEC.loader.exec_module(PROFILE)


def trade(identifier, pnl):
    return {"signal_id": identifier, "pnl": pnl, "fees": 0.01, "slippage": 0.02}


class ConsolidatedBootstrapContract(unittest.TestCase):
    def test_seeded_paired_and_block_results_reproducible(self):
        base = [trade(str(i), float(i) / 10) for i in range(24)]
        variant = [trade(str(i), float(i) / 10 + (i % 3) / 100) for i in range(24)]
        paired = MODULE.paired_expectancy_bootstrap(base, variant, runs=50, seed=17)
        self.assertEqual(paired, MODULE.paired_expectancy_bootstrap(base, variant, runs=50, seed=17))
        self.assertEqual(paired["paired"], 24)
        self.assertEqual(set(paired), {"paired", "delta_mean", "ci95", "positive_supported", "negative_supported"})
        block = MODULE.block_bootstrap_expectancy(base, block_size=4, runs=50, seed=23)
        self.assertEqual(block, MODULE.block_bootstrap_expectancy(base, block_size=4, runs=50, seed=23))
        self.assertEqual(set(block), {"samples", "blocks", "ci95"})

    def test_invalid_controls_refuse(self):
        for runs in (True, False, 0, -1, 0.5, "2"):
            with self.subTest(runs=runs), self.assertRaises(ValueError):
                MODULE.paired_expectancy_bootstrap([trade("a", 1), trade("b", 2)],
                                                    [trade("a", 2), trade("b", 3)], runs=runs)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            MODULE.paired_expectancy_bootstrap([trade("a", 1), trade("a", 2)], [trade("a", 3)])
        for value in (math.nan, math.inf, -math.inf):
            with self.subTest(value=value), self.assertRaises(ValueError):
                MODULE.block_bootstrap_expectancy([trade("a", value), trade("b", 1)], block_size=1, runs=4)

    def test_extreme_finite_mean_and_schemas(self):
        large = [trade("a", 1e308), trade("b", 1e308)]
        self.assertEqual(MODULE.paired_expectancy_bootstrap(
            [trade("a", 0), trade("b", 0)], large, runs=4)["delta_mean"], 1e308)
        self.assertEqual(MODULE.block_bootstrap_expectancy(large, block_size=1, runs=4)["ci95"],
                         [1e308, 1e308])
        self.assertEqual(MODULE.paired_expectancy_bootstrap([], [], runs=1),
                         {"paired": 0, "delta_mean": None, "ci95": None})


    def test_exact_pinned_finite_baseline_numerical_parity(self):
        # Independent immutable prior implementation; no Grid runtime or provider.
        reference = subprocess.check_output(
            ["git", "--no-replace-objects", "-C", str(ROOT), "show",
             "b9c2f24b33285b7b0e06aebc354a9c61a909d204:python/history_statistics.py"],
            timeout=10)
        self.assertEqual(hashlib.sha256(reference).hexdigest(),
                         "c6db429dd77c88abe263c52dd0db4e5e76f321657dec53eb1ccec44280197371")
        previous = {}
        exec(compile(reference, "<pinned-math-finite-bootstrap-v2>", "exec"), previous)
        cases = [
            [trade(str(i), i * 0.03125) for i in range(16)],
            [trade(str(i), 1e308) for i in range(8)],
            [trade(str(i), 5e-324) for i in range(8)],
            [trade(str(i), v) for i, v in enumerate([1e308, -1e308] * 4)],
        ]
        for rows in cases:
            old_paired = previous["paired_expectancy_bootstrap"]
            old_block = previous["block_bootstrap_expectancy"]
            first = [dict(row, pnl=0) for row in rows]
            with self.subTest(kind="paired", rows=len(rows), value=rows[0]["pnl"]):
                self.assertEqual(MODULE.paired_expectancy_bootstrap(first, rows, runs=30, seed=17),
                                 old_paired(first, rows, runs=30, seed=17))
            with self.subTest(kind="block", rows=len(rows), value=rows[0]["pnl"]):
                self.assertEqual(MODULE.block_bootstrap_expectancy(rows, block_size=2, runs=30, seed=23),
                                 old_block(rows, block_size=2, runs=30, seed=23))

    def test_input_records_are_not_mutated(self):
        original = [trade("a", 1), trade("b", 2)]
        before = [dict(row) for row in original]
        MODULE.block_bootstrap_expectancy(original, block_size=1, runs=4)
        self.assertEqual(original, before)



class MetaMarketMathContract(unittest.TestCase):
    def test_decimal_price_bucket_exact_half_up(self):
        for price, tick, expected in (
            ("1.234", "0.01", "1.23"),
            ("1.235", "0.01", "1.24"),
            ("1.225", "0.01", "1.23"),
            ("100.005", "0.01", "100.01"),
        ):
            with self.subTest(price=price, tick=tick):
                self.assertEqual(PROFILE.price_bucket(Decimal(price), Decimal(tick)), Decimal(expected))

    def test_distinct_meta_poc_tie_contracts(self):
        profile = {Decimal("100"): Decimal("1"), Decimal("101"): Decimal("1")}
        # Meta core.Minute.poc chooses the price nearest the candle close.
        self.assertEqual(PROFILE.volume_profile_poc(profile, close=Decimal("101")), Decimal("101"))
        self.assertEqual(PROFILE.volume_profile_poc(profile, close=Decimal("100.5")), Decimal("100"))
        # Meta footprint.Footprint.poc chooses the lower price for equal volume.
        self.assertEqual(PROFILE.volume_profile_poc(profile), Decimal("100"))
        self.assertEqual(PROFILE.volume_profile_poc({}), None)
        with self.assertRaisesRegex(ValueError, "empty volume profile"):
            PROFILE.volume_profile_poc({}, close=Decimal("100"))


    def test_exact_pinned_meta_core_and_footprint_parity(self):
        """Execute original immutable Meta algorithm bytes against the Math owner."""
        reference_root = ROOT / "reference-meta"
        if not reference_root.is_dir():
            self.fail("PINNED_META_REFERENCE_MISSING: checkout required, never skip")
        upstream = "f3c01a23fa5baaeeeb28eb8e9397e72b5ef4d5a1"
        def original(path, oid):
            source = subprocess.check_output(
                ["git", "--no-replace-objects", "-C", str(reference_root),
                 "show", upstream + ":" + path], timeout=15)
            observed = subprocess.check_output(
                ["git", "hash-object", "--stdin"], input=source, timeout=15
            ).decode().strip()
            self.assertEqual(observed, oid, "META_SOURCE_BLOB_MISMATCH:" + path)
            return source
        core = original("src/meta_analyse/core.py",
                        "d75c40244f5a486f87d710e818c2194212a74f67")
        footprint = original("src/meta_analyse/footprint.py",
                             "7ba45e2073ca989dda222d63bda116f2c5741ec0")
        tape_source = original("src/meta_analyse/tape_velocity.py",
                               "b97a681a70a60c9e9e8a9381591b60a27b2b7519")
        wall_source = original("src/meta_analyse/wall_tracker.py",
                               "a393ca3f09e52a467eda3b9745aaf154d4f13345")
        orderflow_source = original("src/meta_analyse/orderflow_metrics.py",
                                    "81233ea9d36b38d75615ac169ea0f41d6eca02ef")
        aggregate_source = original("src/meta_analyse/orderflow_aggregation.py",
                                    "f56837a23b80df373cde5a120e7637850d229a80")
        package = types.ModuleType("pinned_meta_math_reference")
        package.__path__ = []
        core_module = types.ModuleType("pinned_meta_math_reference.core")
        footprint_module = types.ModuleType("pinned_meta_math_reference.footprint")
        tape_module = types.ModuleType("pinned_meta_math_reference.tape_velocity")
        wall_module = types.ModuleType("pinned_meta_math_reference.wall_tracker")
        orderflow_module = types.ModuleType("pinned_meta_math_reference.orderflow_metrics")
        aggregate_module = types.ModuleType("pinned_meta_math_reference.orderflow_aggregation")
        namespace = {"pinned_meta_math_reference": package,
                     "pinned_meta_math_reference.core": core_module,
                     "pinned_meta_math_reference.footprint": footprint_module,
                     "pinned_meta_math_reference.tape_velocity": tape_module,
                     "pinned_meta_math_reference.wall_tracker": wall_module,
                     "pinned_meta_math_reference.orderflow_metrics": orderflow_module,
                     "pinned_meta_math_reference.orderflow_aggregation": aggregate_module}
        previous = {key: sys.modules.get(key) for key in namespace}
        try:
            sys.modules.update(namespace)
            exec(compile(core, "<pinned-meta-core>", "exec"), core_module.__dict__)
            exec(compile(footprint, "<pinned-meta-footprint>", "exec"),
                 footprint_module.__dict__)
            exec(compile(tape_source, "<pinned-meta-tape-velocity>", "exec"),
                 tape_module.__dict__)
            exec(compile(wall_source, "<pinned-meta-wall-tracker>", "exec"),
                 wall_module.__dict__)
            exec(compile(orderflow_source, "<pinned-meta-orderflow>", "exec"),
                 orderflow_module.__dict__)
            exec(compile(aggregate_source, "<pinned-meta-aggregation>", "exec"),
                 aggregate_module.__dict__)
            D = Decimal
            for n in range(1, 120):
                price = D(n) / D("1000")
                tick = (D("0.01"), D("0.005"), D("0.1"))[n % 3]
                with self.subTest(case=n):
                    self.assertEqual(PROFILE.price_bucket(price, tick),
                                     core_module.price_bucket(price, tick))
            now = datetime(2026, 11, 19, tzinfo=timezone.utc)
            for close in (D("100"), D("101"), D("100.5")):
                minute = core_module.Minute(now, D("1"), close, close, close, close)
                minute.profile = {D("100"): D("2"), D("101"): D("2")}
                self.assertEqual(PROFILE.volume_profile_poc(minute.profile, close=close),
                                 minute.poc)
                cells = {price: footprint_module.FootprintCell(buy=volume)
                         for price, volume in minute.profile.items()}
                book = footprint_module.Footprint("BTCUSDT", 0, 60000, D("1"), cells)
                self.assertEqual(PROFILE.volume_profile_poc(minute.profile), book.poc)
                self.assertEqual(PROFILE.executed_volume_delta(D("5"), D("3")),
                                 footprint_module.FootprintCell(D("5"), D("3")).delta)
            original_candles = [
                core_module.Candle(now, D("101"), D("99"), D("100"), D("100")),
                core_module.Candle(now+timedelta(days=1), D("102"), D("99"), D("100"), D("101")),
            ]
            original_levels = core_module.untouched_levels(original_candles, "D1")
            new_levels = PROFILE.untouched_decimal_levels([
                (int(c.start.timestamp()*1000), c.high, c.low) for c in original_candles
            ])
            self.assertEqual(
                [(level.kind, level.price, int(level.source_start.timestamp()*1000))
                 for level in original_levels],
                list(new_levels)
            )
            self.assertEqual({(side,price) for side,price,_ in new_levels},
                             {("high",D("102")),("low",D("99"))})
            first = types.SimpleNamespace(timestamp_ms=1000,price=D("100"),
                                           quantity=D("1"),taker_side="Buy")
            second = types.SimpleNamespace(timestamp_ms=2000,price=D("101"),
                                            quantity=D("2"),taker_side="Sell")
            original_tape = tape_module.TapeVelocity(D("1"),window_ms=5000,
                                                     proximity_ticks=20)
            original_tape.add(first,D("100"),contiguous=True)
            original_snapshot = original_tape.add(second,D("100"),contiguous=True)
            new_snapshot = PROFILE.tape_velocity_metrics(
                [(first.timestamp_ms,first.price,first.quantity,first.taker_side),
                 (second.timestamp_ms,second.price,second.quantity,second.taker_side)],
                 D("100"),D("1"),5000,D("20"),2000,observed_price=D("101"))
            self.assertEqual(new_snapshot,(
                original_snapshot.trades_per_second,original_snapshot.notional_per_second,
                original_snapshot.buy_notional,original_snapshot.sell_notional,
                original_snapshot.distance_ticks
            ))
            flow = core_module.RollingFlow()
            flow_trade = core_module.Trade("BTCUSDT",now+timedelta(seconds=1),
                                         D("10"),D("100"),"Buy")
            flow.add(flow_trade)
            point = now+timedelta(seconds=2)
            expected_flow = flow.metrics(point)[60]
            observed_flow = PROFILE.flow_window_metrics([
                (int(flow_trade.time.timestamp()*1000),flow_trade.price*flow_trade.size,"buy")
            ],int(point.timestamp()*1000),60)
            self.assertEqual(observed_flow,expected_flow)
            wall_score = flow.wall_score(D("10"),D("100"),point)
            self.assertEqual(PROFILE.wall_turnover_ratios(
                D("10"),D("100"),{s:flow.metrics(point)[s]["turnover_usd"]
                                 for s in (60,300,3600)}),wall_score)
            tracker = wall_module.WallTracker(min_notional=D("100000"),max_age_ms=3000)
            book = types.SimpleNamespace(valid=True,bids={D("100"):D("1000")},asks={})
            self.assertEqual(tracker.observe(book,1000),[])
            warning = tracker.observe(types.SimpleNamespace(valid=True,bids={},asks={}),2000)
            self.assertEqual(len(warning),1)
            self.assertEqual(PROFILE.wall_notional(D("100"),D("1000")),warning[0].notional)
            old_trades = [
                orderflow_module.Trade(1000,D("100"),D("3"),"buy"),
                orderflow_module.Trade(1001,D("100.1"),D("1"),"sell"),
                orderflow_module.Trade(1002,D("100.2"),D("7"),"unknown")
            ]
            old_flow = orderflow_module.calculate(old_trades,initial_delta=D("5"))
            new_flow = PROFILE.orderflow_volume_metrics(
                [(t.price,t.volume,t.side) for t in old_trades],D("5"))
            self.assertEqual(new_flow,vars(old_flow))
            new_trades=[(t.timestamp_ms,t.price,t.volume,t.side) for t in old_trades]
            for mode, kwargs in (("time",{"interval_ms":1000}),("price",{"tick_size":D("0.1")})):
                expected = (aggregate_module.aggregate_by_time(old_trades,1000,initial_delta=D("5"))
                            if mode == "time"
                            else aggregate_module.aggregate_by_price(old_trades,D("0.1"),
                                                                     initial_delta=D("5")))
                actual = PROFILE.aggregate_orderflow(new_trades,mode=mode,
                                                      initial_delta=D("5"),**kwargs)
                self.assertEqual([(key,vars(metric)) for key,metric in expected],
                                 list(actual))
            zero_flow = orderflow_module.calculate([
                orderflow_module.Trade(1000,D("100"),D("2"),"unknown")])
            self.assertEqual(PROFILE.orderflow_volume_metrics(
                [(D("100"),D("2"),"unknown")]),vars(zero_flow))
            empty = core_module.Minute(now, D("1"), D("100"), D("100"),
                                       D("100"), D("100"))
            with self.assertRaises(ValueError):
                _ = empty.poc
            with self.assertRaises(ValueError):
                PROFILE.volume_profile_poc({}, close=D("100"))
            self.assertIsNone(PROFILE.volume_profile_poc({}))
        finally:
            for key, old in previous.items():
                if old is None:
                    sys.modules.pop(key, None)
                else:
                    sys.modules[key] = old

    def test_meta_tape_wall_flow_pure_arithmetic(self):
        D=Decimal
        events=[(1000,D("100"),D("1"),"Buy"),(2000,D("101"),D("2"),"Sell")]
        tape=PROFILE.tape_velocity_metrics(events,D("100"),D("1"),5000,D("20"),2000,observed_price=D("101"))
        self.assertEqual(tape,(D("0.4"),D("60.4"),D("100"),D("202"),D("1")))
        self.assertEqual(PROFILE.wall_notional(D("100"),D("1000")),D("100000"))
        flow=PROFILE.flow_window_metrics([(1000,D("100"),"buy"),(2000,D("202"),"sell")],2000,60)
        self.assertEqual(flow,{"turnover_usd":D("302"),"trades":2,"buy_usd":D("100"),
                              "sell_usd":D("202"),"trades_per_second":D(2)/D(60)})
        ratios=PROFILE.wall_turnover_ratios(D("10"),D("100"),{60:D("1000"),300:D("0")})
        self.assertEqual(ratios["wall_usd"],D("1000"))
        self.assertEqual(ratios["ratios"],{60:D("1"),300:D("1000")})
        for bad in ((1000,D("100"),D("-1"),"Buy"),(1000,D("100"),D("1"),"INVALID")):
            with self.assertRaises(ValueError):
                PROFILE.tape_velocity_metrics([bad],D("100"),D("1"),5000,D("20"),2000)

    def test_untouched_levels_refuse_unverified_inputs(self):
        D=Decimal
        for candles in (
            [(0,D("100"),D("101"))],
            [(0,D("101"),D("99")),(0,D("102"),D("98"))],
            [(0,D("Infinity"),D("99"))],
            [(True,D("101"),D("99"))],
            [(0,D("101"),D("0"))],
        ):
            with self.subTest(candles=repr(candles)),self.assertRaises(ValueError):
                PROFILE.untouched_decimal_levels(candles)

    def test_delta_and_invalid_decimal_inputs_refuse(self):
        self.assertEqual(PROFILE.executed_volume_delta(Decimal("3"), Decimal("1")), Decimal("2"))
        self.assertEqual(PROFILE.executed_volume_delta(Decimal("0"), Decimal("0")), Decimal("0"))
        for value in (Decimal("NaN"), Decimal("Infinity"), Decimal("-Infinity"), Decimal("-1"), 1.0):
            with self.subTest(value=repr(value)):
                with self.assertRaises(ValueError):
                    PROFILE.price_bucket(value, Decimal("0.01"))
                with self.assertRaises(ValueError):
                    PROFILE.executed_volume_delta(value, Decimal("1"))
        with self.assertRaises(ValueError):
            PROFILE.price_bucket(Decimal("1"), Decimal("0"))
        with self.assertRaises(ValueError):
            PROFILE.volume_profile_poc({Decimal("100"): Decimal("-1")})



class BoundedComputeApiContract(unittest.TestCase):
    def test_versioned_batch_and_no_authorization(self):
        sys.path.insert(0, str(ROOT / "python"))
        try:
            from market_compute_api import compute_batch
        finally:
            sys.path.pop(0)
        request = {"schema": "math.market.compute.v1", "execution_authority": False,
                   "source": {"snapshot_sha256": "a" * 64, "as_of_ms": 1700000000000,
                              "units": {"price": "quote/base", "volume": "base"}},
                   "operations": [
                       {"operation": "price_bucket", "input": {"price": "1.235", "tick": "0.01"}},
                       {"operation": "volume_profile_poc", "input": {"close": "101", "profile": [
                           {"price": "100", "volume": "2"}, {"price": "101", "volume": "2"}]}},
                       {"operation": "executed_volume_delta", "input": {"buy": "3", "sell": "1"}}]}
        first = compute_batch(request)
        self.assertEqual(first, compute_batch(request))
        self.assertEqual([x["value"] for x in first["results"]], ["1.24", "101", "2"])
        self.assertFalse(first["execution_authority"])
        self.assertFalse(first["trading_authorized"])
        self.assertEqual(first["provenance"], "CALLER_SUPPLIED_UNATTESTED")

    def test_batch_units_precision_provenance_and_no_caller_alias(self):
        sys.path.insert(0, str(ROOT / "python"))
        try:
            from market_compute_api import compute_batch
        finally:
            sys.path.pop(0)
        request = {"schema": "math.market.compute.v1", "execution_authority": False,
                   "source": {"snapshot_sha256": "a" * 64, "as_of_ms": 3,
                              "units": {"price": "quote/base", "volume": "base"}},
                   "operations": [
                       {"operation": "price_bucket", "input": {"price": "100.005", "tick": "0.01"}},
                       {"operation": "executed_volume_delta",
                        "input": {"buy": "100000000000000000000.001", "sell": "100000000000000000000"}}]}
        with localcontext() as ambient:
            ambient.prec = 4
            ambient.rounding = "ROUND_DOWN"
            result = compute_batch(request)
        self.assertEqual([x["value"] for x in result["results"]], ["100.01", "0.001"])
        self.assertEqual([x["unit"] for x in result["results"]], ["quote/base", "base"])
        self.assertEqual(result["numeric_policy"]["precision"], 96)
        self.assertEqual(result["algorithm_version"], "math.market.v1")
        request["source"]["units"]["price"] = "CHANGED"
        self.assertEqual(result["source"]["units"]["price"], "quote/base")
        self.assertEqual(result["provenance"], "CALLER_SUPPLIED_UNATTESTED")
        self.assertFalse(result["execution_authority"])
        self.assertFalse(result["trading_authorized"])

    def test_batch_levels_and_wall_no_unclosed_candles(self):
        sys.path.insert(0, str(ROOT / "python"))
        try:
            from market_compute_api import compute_batch
        finally:
            sys.path.pop(0)
        base = {"schema":"math.market.compute.v1","execution_authority":False,
                "source":{"snapshot_sha256":"c"*64,"as_of_ms":200000000,
                          "units":{"price":"quote/base","volume":"base"}}}
        candles = [{"start_ms":1000,"high":"101","low":"99","complete":True},
                   {"start_ms":2000,"high":"102","low":"99","complete":True}]
        request = dict(base,operations=[
            {"operation":"untouched_decimal_levels","input":{"candles":candles}},
            {"operation":"wall_notional","input":{"price":"100","size":"1000"}}])
        result=compute_batch(request)
        self.assertEqual(result["results"][0]["value"],[
            {"side":"high","price":"102","origin_ms":2000},
            {"side":"low","price":"99","origin_ms":2000}])
        self.assertEqual(result["results"][1]["value"],"100000")
        self.assertEqual(result["results"][1]["unit"],"quote")
        self.assertFalse(result["trading_authorized"])
        invalid=dict(base,operations=[
            {"operation":"untouched_decimal_levels",
             "input":{"candles":[dict(candles[0],complete=False)]}}])
        with self.assertRaisesRegex(ValueError,"UNCLOSED_CANDLE"):
            compute_batch(invalid)
        duplicates=dict(base,operations=[
            {"operation":"untouched_decimal_levels",
             "input":{"candles":[candles[0],dict(candles[0],high="103")]}}])
        with self.assertRaisesRegex(ValueError,"DUPLICATE_CANDLE_TIME"):
            compute_batch(duplicates)

    def test_batch_tape_flow_wall_and_fail_closed_continuity(self):
        sys.path.insert(0, str(ROOT / "python"))
        try:
            from market_compute_api import compute_batch
        finally:
            sys.path.pop(0)
        tape = {"operation":"tape_velocity_metrics","input":{
            "events":[{"timestamp_ms":1000,"price":"100","quantity":"1","side":"Buy"},
                      {"timestamp_ms":2000,"price":"101","quantity":"2","side":"Sell"}],
            "level_price":"100","tick_size":"1","window_ms":5000,
            "proximity_ticks":"20","now_ms":2000,"observed_price":"101",
            "contiguous":True}}
        flow = {"operation":"flow_window_metrics","input":{
            "events":[{"timestamp_ms":1000,"notional":"100","side":"buy"},
                      {"timestamp_ms":2000,"notional":"202","side":"sell"}],
            "now_ms":2000,"window_seconds":60}}
        walls = {"operation":"wall_turnover_ratios","input":{
            "price":"10","size":"100","turnovers":{"60":"1000","300":"0","3600":"302"}}}
        base={"schema":"math.market.compute.v1","execution_authority":False,
              "source":{"snapshot_sha256":"d"*64,"as_of_ms":2000,
                        "units":{"price":"quote/base","volume":"base"}},
              "operations":[tape,flow,walls]}
        out=compute_batch(base)
        self.assertEqual(out["results"][0]["value"],{
            "trades_per_second":"0.4","notional_per_second":"60.4",
            "buy_notional":"100","sell_notional":"202","distance_ticks":"1"})
        self.assertEqual(out["results"][1]["value"]["turnover_usd"],"302")
        self.assertEqual(out["results"][1]["value"]["trades"],2)
        self.assertEqual(out["results"][1]["value"]["buy_usd"],"100")
        self.assertEqual(out["results"][1]["value"]["sell_usd"],"202")
        with localcontext() as numeric:
            numeric.prec=96
            self.assertEqual(out["results"][1]["value"]["trades_per_second"],
                             str(Decimal(2)/Decimal(60)))
        self.assertEqual(out["results"][2]["value"]["wall_usd"],"1000")
        classified={"operation":"orderflow_volume_metrics","input":{
            "trades":[{"price":"100","volume":"3","side":"buy"},
                      {"price":"100.1","volume":"1","side":"sell"},
                      {"price":"100.2","volume":"7","side":"unknown"}],
            "initial_delta":"5"}}
        extra=compute_batch(dict(base,operations=[classified]))
        self.assertEqual(extra["results"][0]["value"],{
            "buy_volume":"3","sell_volume":"1","unknown_volume":"7",
            "delta":"2","cumulative_delta":"7","imbalance":"0.5","trade_count":3})
        self.assertFalse(extra["trading_authorized"])
        self.assertEqual(out["results"][2]["value"]["ratios"]["60"],"1")
        self.assertEqual(out["results"][0]["unit"],"mixed")
        bad_tape = dict(tape, input=dict(tape["input"], contiguous=False))
        with self.assertRaisesRegex(ValueError, "UNTRUSTED_TAPE_CONTINUITY"):
            compute_batch(dict(base, operations=[bad_tape]))
        reversed_tape = dict(tape, input=dict(tape["input"],
                           events=list(reversed(tape["input"]["events"]))))
        with self.assertRaisesRegex(ValueError, "NONMONOTONIC_TAPE"):
            compute_batch(dict(base, operations=[reversed_tape]))

    def test_batch_orderflow_aggregations_and_unknown_side(self):
        sys.path.insert(0,str(ROOT/"python"))
        try:
            from market_compute_api import compute_batch
        finally:
            sys.path.pop(0)
        records=[{"timestamp_ms":2000,"price":"100.19","volume":"3","side":"buy"},
                 {"timestamp_ms":999,"price":"100.09","volume":"2","side":"sell"},
                 {"timestamp_ms":1000,"price":"100.11","volume":"1","side":"buy"},
                 {"timestamp_ms":1001,"price":"100.12","volume":"7","side":"unknown"}]
        source={"snapshot_sha256":"f"*64,"as_of_ms":3000,
                "units":{"price":"quote/base","volume":"base"}}
        operations=[
            {"operation":"aggregate_orderflow","input":{
                "trades":records,"mode":"time","interval_ms":1000,
                "tick_size":None,"initial_delta":"5"}},
            {"operation":"aggregate_orderflow","input":{
                "trades":records,"mode":"price","interval_ms":None,
                "tick_size":"0.1","initial_delta":"5"}}]
        out=compute_batch({"schema":"math.market.compute.v1","execution_authority":False,
                           "source":source,"operations":operations})
        self.assertEqual([x["bucket"] for x in out["results"][0]["value"]],[0,1000,2000])
        self.assertEqual([x["metrics"]["cumulative_delta"] for x in out["results"][0]["value"]],
                         ["3","4","7"])
        self.assertEqual([x["bucket"] for x in out["results"][1]["value"]],
                         ["100.0","100.1"])
        self.assertEqual(out["results"][1]["value"][1]["metrics"]["unknown_volume"],"7")
        self.assertEqual(out["provenance"],"CALLER_SUPPLIED_UNATTESTED")
        with self.assertRaises(ValueError):
            compute_batch({"schema":"math.market.compute.v1","execution_authority":False,
                           "source":source,"operations":[
                               {"operation":"aggregate_orderflow","input":{
                                   "trades":records,"mode":"price","interval_ms":None,
                                   "tick_size":"0","initial_delta":"5"}}]})

    def test_batch_rejects_untrusted_fields_and_bad_shapes(self):
        sys.path.insert(0, str(ROOT / "python"))
        try:
            from market_compute_api import compute_batch
        finally:
            sys.path.pop(0)
        base = {"schema": "math.market.compute.v1", "execution_authority": False,
                "source": {"snapshot_sha256": "b" * 64, "as_of_ms": 1,
                           "units": {"price": "quote/base", "volume": "base"}},
                "operations": [{"operation": "price_bucket",
                                "input": {"price": "2", "tick": "0.01"}}]}
        bad = [dict(base, execution_authority=True),
               dict(base, extra="field"),
               dict(base, operations=[]),
               dict(base, operations=base["operations"] * 257),
               dict(base, operations=[{"operation": "unknown", "input": {}}]),
               dict(base, source=dict(base["source"], snapshot_sha256="INVALID")),
               dict(base, operations=[{"operation": "price_bucket",
                                       "input": {"price": "NaN", "tick": "0.01"}}]),
               dict(base, operations=[{"operation": "price_bucket",
                                       "input": {"price": "1e1000", "tick": "0.01"}}]),
               dict(base, operations=[{"operation": [], "input": {}}]),
               dict(base, operations=[{"operation": "volume_profile_poc",
                                       "input": {"close": None, "profile": [
                                           {"price": "1", "volume": "1"},
                                           {"price": "1.0", "volume": "2"}]}}])]
        for index, item in enumerate(bad):
            with self.subTest(case=index), self.assertRaises(ValueError):
                compute_batch(item)


if __name__ == "__main__":
    unittest.main()
