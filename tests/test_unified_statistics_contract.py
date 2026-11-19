"""Runtime-neutral exact parity and refusal controls for Math statistics.

This test suite exercises the committed module; does not contact Grid or an exchange.
"""
import importlib.util
import math
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("math_owned_statistics", ROOT / "python/history_statistics.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


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

    def test_input_records_are_not_mutated(self):
        original = [trade("a", 1), trade("b", 2)]
        before = [dict(row) for row in original]
        MODULE.block_bootstrap_expectancy(original, block_size=1, runs=4)
        self.assertEqual(original, before)


if __name__ == "__main__":
    unittest.main()
