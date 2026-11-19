"""Finite inputs must not manufacture infinite evidence of positive expectancy."""
import copy
import math
import unittest

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
from history_statistics import paired_observation_bootstrap, block_observation_bootstrap


def observation(key, value):
    return key, value


class BootstrapOverflowTests(unittest.TestCase):
    def test_smallest_representable_delta_does_not_underflow_during_mean(self):
        base = [observation("a", 0), observation("b", 0)]
        variant = [observation("a", 5e-324), observation("b", 5e-324)]
        result = paired_observation_bootstrap(base, variant, runs=4)
        self.assertEqual(result["delta_mean"], 5e-324)
        self.assertEqual(result["ci95"], [5e-324, 5e-324])

    def test_large_cancellation_retains_representable_small_mean(self):
        values = [1e308, 1e308, -1e308, -1e308] + [5e-324] * 100
        result = paired_observation_bootstrap([observation(str(i), 0) for i in range(len(values))],
                                            [observation(str(i), value) for i, value in enumerate(values)], runs=2)
        self.assertEqual(result["delta_mean"], 5e-324)

    def test_unrepresentable_paired_difference_is_refused(self):
        base = [observation("a", -1e308), observation("b", -1e308)]
        variant = [observation("a", 1e308), observation("b", 1e308)]
        with self.assertRaisesRegex(ValueError, "finite|representable"):
            paired_observation_bootstrap(base, variant, runs=4)

    def test_representable_large_paired_mean_is_finite(self):
        base = [observation("a", 0), observation("b", 0)]
        variant = [observation("a", 1e308), observation("b", 1e308)]
        result = paired_observation_bootstrap(base, variant, runs=4)
        self.assertEqual(result["delta_mean"], 1e308)
        self.assertEqual(result["ci95"], [1e308, 1e308])

    def test_representable_large_block_mean_is_finite(self):
        result = block_observation_bootstrap([1e308, 1e308], block_size=1, runs=4)
        self.assertEqual(result["ci95"], [1e308, 1e308])

    def test_many_finite_values_do_not_overflow_before_division(self):
        base = [observation(str(i), 0) for i in range(64)]
        variant = [observation(str(i), 1e307) for i in range(64)]
        result = paired_observation_bootstrap(base, variant, runs=4)
        self.assertTrue(math.isfinite(result["delta_mean"]))
        self.assertTrue(math.isclose(result["delta_mean"], 1e307))
        self.assertTrue(all(math.isfinite(value) for value in result["ci95"]))

    def test_large_mixed_sign_block_samples_remain_finite_and_seeded(self):
        values = [1e308, -1e308] * 3
        first = block_observation_bootstrap(values, block_size=1, runs=16, seed=9)
        self.assertEqual(first, block_observation_bootstrap(values, block_size=1, runs=16, seed=9))
        self.assertTrue(all(math.isfinite(value) for value in first["ci95"]))

    def test_refusal_does_not_mutate_original_trade_records(self):
        base = [observation("a", -1e308), observation("b", -1e308)]
        variant = [observation("a", 1e308), observation("b", 1e308)]
        before = copy.deepcopy((base, variant))
        with self.assertRaises(ValueError):
            paired_observation_bootstrap(base, variant, runs=4)
        self.assertEqual((base, variant), before)

    def test_ordinary_supported_delta_is_preserved(self):
        result = paired_observation_bootstrap([observation("a", 0), observation("b", 0)],
                                            [observation("a", 1), observation("b", 1)], runs=8)
        self.assertEqual(result["delta_mean"], 1)
        self.assertEqual(result["ci95"], [1, 1])
        self.assertTrue(result["positive_supported"])

    def test_zero_delta_does_not_become_directional_support(self):
        values = [observation("a", 1e308), observation("b", -1e308)]
        result = paired_observation_bootstrap(values, values, runs=8)
        self.assertEqual(result["delta_mean"], 0)
        self.assertFalse(result["positive_supported"])
        self.assertFalse(result["negative_supported"])
