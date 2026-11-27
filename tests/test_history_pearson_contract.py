"""Developer-only H contract tests; U must independently seal its own oracle."""
import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "python"))
from history_pearson import pearson_aligned_v1, _budget_costs
try:
    from math_resource_budget import BudgetLimits, BudgetCounter, BudgetExceeded
    HAS_V = True
except ImportError:
    HAS_V = False


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
                                    'PEARSON_(INVALID_SHARED_BUDGET|SHARED_BUDGET_DEPENDENCY_UNAVAILABLE)'):
            pearson_aligned_v1([1, 2, 3], [1, 2, 3],
                               numeric_policy_ref=POLICY, budget=object())


@unittest.skipUnless(HAS_V, 'V budget dependency absent in isolated H branch')
class MeteredPearsonDeveloperTests(unittest.TestCase):
    def setUp(self):
        self.x = [-1.0, 0.0, 1.0]
        self.y = [-1.0, 2.0**-30, 1.0]
        self.costs = _budget_costs(len(self.x))

    def counter(self, **overrides):
        limits = dict(max_ops=self.costs['ops'], max_read_bytes=self.costs['read_bytes'],
                      max_write_bytes=self.costs['write_bytes'],
                      max_live_bytes=self.costs['live_bytes'],
                      max_output_bytes=self.costs['output_bytes'])
        limits.update(overrides)
        return BudgetCounter(BudgetLimits(**limits))

    def test_shared_counter_exact_result_and_cleanup(self):
        budget = self.counter()
        r = pearson_aligned_v1(self.x,self.y,numeric_policy_ref=POLICY,budget=budget)
        control = pearson_aligned_v1(self.x,self.y,numeric_policy_ref=POLICY)
        self.assertEqual(r, control)
        self.assertTrue(r.rounded_endpoint)
        snap = budget.snapshot()
        self.assertEqual((snap['ops'],snap['read_bytes'],snap['write_bytes'],
                          snap['peak_bytes'],snap['output_bytes'],snap['live_bytes']),
                         (self.costs['ops'],self.costs['read_bytes'],self.costs['write_bytes'],
                          self.costs['live_bytes'],self.costs['output_bytes'],0))
        self.assertFalse(snap['failed'])

    def test_preflight_short_one_credit_terminal(self):
        budget = self.counter(max_ops=self.costs['ops']-1)
        with self.assertRaises(BudgetExceeded):
            pearson_aligned_v1(self.x,self.y,numeric_policy_ref=POLICY,budget=budget)
        snap=budget.snapshot()
        self.assertEqual((snap['ops'],snap['output_bytes'],snap['live_bytes']), (0,0,0))
        self.assertTrue(snap['failed'])
        with self.assertRaises(BudgetExceeded):
            budget.charge('other', ops=0)

    def test_all_dimensions_preflight_atomic(self):
        for limit_name, cost_name in [('max_read_bytes','read_bytes'),
                                      ('max_write_bytes','write_bytes'),
                                      ('max_live_bytes','live_bytes'),
                                      ('max_output_bytes','output_bytes')]:
            with self.subTest(limit=limit_name):
                budget=self.counter(**{limit_name:self.costs[cost_name]-1})
                with self.assertRaises(BudgetExceeded):
                    pearson_aligned_v1(self.x,self.y,numeric_policy_ref=POLICY,budget=budget)
                snap=budget.snapshot()
                self.assertEqual((snap['ops'],snap['live_bytes'],snap['output_bytes']),(0,0,0))
                self.assertTrue(snap['failed'])

    def test_shared_existing_charge_must_not_reset(self):
        budget=self.counter(max_ops=self.costs['ops']+100)
        budget.charge('other',ops=100)
        pearson_aligned_v1(self.x,self.y,numeric_policy_ref=POLICY,budget=budget)
        snap=budget.snapshot()
        self.assertEqual(snap['ops'],self.costs['ops']+100)
        self.assertEqual(snap['by_kind']['other'],100)
        self.assertEqual(snap['by_kind']['pearson'],self.costs['ops'])

    def test_scratch_release_on_invalid_observation(self):
        budget=self.counter()
        with self.assertRaisesRegex(ValueError,'PEARSON_LOSSLESS_FINITE_BINARY64_REQUIRED'):
            pearson_aligned_v1([1.0,float('inf'),3.0],self.y,
                               numeric_policy_ref=POLICY,budget=budget)
        snap=budget.snapshot()
        self.assertEqual(snap['live_bytes'],0)
        self.assertFalse(snap['failed'])  # Input invalid, no budget exhaustion
        self.assertEqual(snap['output_bytes'],0)
        self.assertEqual(snap['ops'],self.costs['ops'])

    def test_uncapped_support_refused_before_meter_work(self):
        budget=self.counter()
        with self.assertRaisesRegex(ValueError,'PEARSON_EXACT_EQUAL_BOUNDED_SUPPORT_REQUIRED'):
            pearson_aligned_v1([0.0]*4097,[0.0]*4097,
                               numeric_policy_ref=POLICY,budget=budget)
        self.assertEqual(budget.snapshot()['ops'],0)

    def test_invalid_fake_or_subclass_counter_denied(self):
        class FakeCounter:
            def preflight(self, **kwargs): raise AssertionError('fake callback invoked')
        class ChildCounter(BudgetCounter): pass
        for obj in (FakeCounter(), ChildCounter(BudgetLimits(0,0,0,0,0))):
            with self.assertRaisesRegex(ValueError,'PEARSON_INVALID_SHARED_BUDGET'):
                pearson_aligned_v1(self.x,self.y,numeric_policy_ref=POLICY,budget=obj)
