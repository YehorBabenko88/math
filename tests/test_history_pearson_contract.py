"""Developer-only H contract tests; U must independently seal its own oracle."""
import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "python"))
from history_pearson import pearson_aligned_v1

POLICY = '0' * 64


class PearsonContractTests(unittest.TestCase):
    def test_perfect_and_rounded_endpoint_distinct(self):
        x = [-1.0, 0.0, 1.0]
        perfect = pearson_aligned_v1(x, x, numeric_policy_ref=POLICY)
        self.assertEqual((perfect.status, perfect.rho, perfect.exact_perfect,
                          perfect.rounded_endpoint), ('OK', 1.0, True, False))
        y = [-1.0, 2.0**-30, 1.0]
        near = pearson_aligned_v1(x, y, numeric_policy_ref=POLICY)
        self.assertEqual((near.status, near.reason_code), ('OK', None))
        self.assertEqual(near.rho, 1.0)
        self.assertFalse(near.exact_perfect)
        self.assertTrue(near.rounded_endpoint)

    def test_nonperfect_basic(self):
        r = pearson_aligned_v1([1, 2, 3], [1, 3, 2], numeric_policy_ref=POLICY)
        self.assertEqual((r.status, r.rho), ('OK', 0.5))
        anti = pearson_aligned_v1([1, 2, 3], [3, 2, 1], numeric_policy_ref=POLICY)
        self.assertEqual((anti.status, anti.rho, anti.exact_perfect),
                         ('OK', -1.0, True))
        orth = pearson_aligned_v1([-1, 0, 1], [1, -2, 1], numeric_policy_ref=POLICY)
        self.assertEqual((orth.status, orth.rho), ('OK', 0.0))

    def test_constant_and_insufficient(self):
        self.assertEqual(pearson_aligned_v1([1, 1, 1], [0, 1, 2],
                         numeric_policy_ref=POLICY).reason_code, 'CONSTANT')
        self.assertEqual(pearson_aligned_v1([0, 1], [0, 1],
                         numeric_policy_ref=POLICY).reason_code, 'INSUFFICIENT_OVERLAP')

    def test_subnormals_and_large_finite(self):
        s = math.ulp(0.0)
        self.assertEqual(pearson_aligned_v1([0, s, 2*s], [0, s, 2*s],
                         numeric_policy_ref=POLICY).rho, 1.0)
        m = float.fromhex('0x1.fffffffffffffp+1023')
        self.assertEqual(pearson_aligned_v1([-m, 0, m], [-1, 0, 1],
                         numeric_policy_ref=POLICY).rho, 1.0)

    def test_order_permutation_preserves_pairs(self):
        original = pearson_aligned_v1([1, 2, 3, 4], [1, 4, 2, 3],
                                      numeric_policy_ref=POLICY)
        permuted = pearson_aligned_v1([4, 2, 1, 3], [3, 4, 1, 2],
                                      numeric_policy_ref=POLICY)
        self.assertEqual(original, permuted)

    def test_nonzero_correlations_must_not_underflow_to_zero(self):
        s = math.ulp(0.0)
        x = [-1.0, 1.0] + [0.0] * 62
        y = [0.0, s] + [1.0, -1.0] * 31
        result = pearson_aligned_v1(x, y, numeric_policy_ref=POLICY)
        self.assertEqual((result.status, result.reason_code),
                         ('REFUSED', 'NUMERIC_REFUSED'))
        self.assertIsNone(result.rho)

    def test_reject_invalid_and_do_not_mutate(self):
        for val in (True, float('nan'), float('inf'), 2**53 + 1):
            with self.assertRaises(ValueError):
                pearson_aligned_v1([1, 2, val], [1, 2, 3],
                                   numeric_policy_ref=POLICY)
        with self.assertRaises(ValueError):
            pearson_aligned_v1([1, 2], [1], numeric_policy_ref=POLICY)
        xs = [1, 2, 3]
        ys = [1, 3, 2]
        pearson_aligned_v1(xs, ys, numeric_policy_ref=POLICY)
        self.assertEqual((xs, ys), ([1, 2, 3], [1, 3, 2]))

    def test_shared_counter_missing_fails_closed(self):
        with self.assertRaisesRegex(ValueError,
                                    'PEARSON_SHARED_BUDGET_DEPENDENCY_UNAVAILABLE'):
            pearson_aligned_v1([1, 2, 3], [1, 2, 3],
                               numeric_policy_ref=POLICY, budget=object())
