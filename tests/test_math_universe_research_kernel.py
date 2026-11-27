"""Reviewed developer tests for the synthetic source-only 4D/32D runner.

These are not independent U mathematical acceptance or market results.
"""
import math
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import math_universe_research_kernel as runner
import history_spherical as sphere
from history_spherical import SphericalError, spherical_apply


def vectors(ambient):
    a = (1.0,) + (0.0,) * (ambient - 1)
    b = (0.0, 1.0) + (0.0,) * (ambient - 2)
    return (a, b, a)


class SyntheticGeometryRunnerTests(unittest.TestCase):
    def run_geometry(self, ambient):
        rows = vectors(ambient)
        stamps = (0, 1000, 2000)
        with mock.patch.object(runner, 'spherical_apply', wraps=sphere.spherical_apply) as calls:
            result = runner.run_synthetic_geometry_v1(rows, stamps, radius=2.0,
                                                      cadence_ms=1000)
        self.assertEqual(calls.call_count, len(rows) + 1)
        self.assertEqual([x.args[0] for x in calls.call_args_list],
                         ['normalize'] * len(rows) + ['trajectory'])
        self.assertEqual(result['ambient_dimension'], ambient)
        self.assertEqual(result['intrinsic_dimension'], ambient - 1)
        self.assertEqual(result['states'][0]['raw'], rows[0])
        self.assertEqual(result['states'][0]['rho'], 1.0)
        self.assertEqual(result['states'][1]['u'], rows[1])
        self.assertEqual(result['event_ms'], stamps)
        self.assertEqual(len(result['trajectory']['angles']), 2)
        self.assertEqual(result['trajectory']['angles'], (math.pi / 2, math.pi / 2))
        self.assertEqual(result['trajectory']['distances'], (math.pi, math.pi))
        self.assertEqual(result['trajectory']['speeds'], (math.pi, math.pi))
        self.assertFalse(result['qualified'])
        self.assertEqual(result['status'], 'UNQUALIFIED')
        self.assertEqual(result['authority'], 'NONE')
        self.assertIsNone(result['fit'])
        self.assertEqual(result['reason'], 'NO_QUALIFIED_SOURCE_OR_FIT')
        self.assertEqual(rows, vectors(ambient))

    def test_4d_geometry_reuses_real_kernels(self):
        self.run_geometry(4)

    def test_32d_geometry_reuses_real_kernels(self):
        self.run_geometry(32)

    def test_zero_direction_refuses_trajectory_without_fabrication(self):
        raw = (vectors(4)[0], (0.0,) * 4)
        with mock.patch.object(runner, 'spherical_apply', wraps=sphere.spherical_apply) as calls:
            result = runner.run_synthetic_geometry_v1(raw, (0, 1000), radius=1.0,
                                                      cadence_ms=1000)
        self.assertEqual(calls.call_count, 2)
        self.assertIsNone(result['trajectory'])
        self.assertEqual(result['reason'], 'ZERO_DIRECTION')
        self.assertEqual(result['states'][1]['rho'], 0.0)
        self.assertIsNone(result['states'][1]['u'])

    def test_gap_is_refused_before_any_numeric_work(self):
        with mock.patch.object(runner, 'spherical_apply', side_effect=AssertionError('called')):
            with self.assertRaisesRegex(SphericalError, 'CADENCE'):
                runner.run_synthetic_geometry_v1(vectors(4), (0, 1000, 3000),
                                                 radius=1.0, cadence_ms=1000)

    def test_cap_rejects_257_before_numeric_work(self):
        rows = (vectors(4)[0],) * 257
        with mock.patch.object(runner, 'spherical_apply', side_effect=AssertionError('called')):
            with self.assertRaisesRegex(SphericalError, 'DIMENSION'):
                runner.run_synthetic_geometry_v1(rows, tuple(range(257)),
                                                 radius=1.0, cadence_ms=1)

    def test_only_exact_tuple_is_admitted(self):
        for invalid in [list(vectors(4)), tuple(list(v) for v in vectors(4)),
                        (vectors(4)[0],)]:
            with self.subTest(invalid=repr(invalid)[:60]):
                with self.assertRaisesRegex(SphericalError, 'DIMENSION'):
                    runner.run_synthetic_geometry_v1(invalid, (0, 1000, 2000),
                                                     radius=1.0, cadence_ms=1000)

    def test_no_attacker_controlled_iteration_or_float_coercion(self):
        class Untrusted:
            def __iter__(self):
                raise AssertionError('untrusted iterator called')
            def __float__(self):
                raise AssertionError('untrusted float coercion called')
        raw = (vectors(4)[0], (Untrusted(), 0.0, 0.0, 0.0))
        with self.assertRaisesRegex(SphericalError, 'INVALID_NUMBER'):
            runner.run_synthetic_geometry_v1(raw, (0, 1000), radius=1.0,
                                             cadence_ms=1000)

    def test_rejects_numeric_types_and_nonfinite(self):
        base = list(vectors(4))
        for bad in (1, True, float('nan'), float('inf'), -float('inf')):
            base[1] = (bad, 0.0, 0.0, 0.0)
            with self.subTest(bad=repr(bad)):
                with self.assertRaisesRegex(SphericalError, 'INVALID_NUMBER'):
                    runner.run_synthetic_geometry_v1(tuple(base), (0,1000,2000),
                                                     radius=1.0,cadence_ms=1000)

    def test_rejects_invalid_time_type_and_range(self):
        cases = [(0, 1000.0, 2000), (0, True, 2000), (0, -1000, 0),
                 (0, 1000, (1 << 53)), [0, 1000, 2000]]
        for stamps in cases:
            with self.subTest(stamps=repr(stamps)):
                with self.assertRaisesRegex(SphericalError, 'CADENCE'):
                    runner.run_synthetic_geometry_v1(vectors(4), stamps,
                                                     radius=1.0,cadence_ms=1000)

    def test_rejects_invalid_cadence_and_radius(self):
        for cadence in (True, 0, -1, 1000.0, (1 << 53)):
            with self.subTest(cadence=cadence):
                with self.assertRaisesRegex(SphericalError, 'CADENCE'):
                    runner.run_synthetic_geometry_v1(vectors(4), (0,1000,2000),
                                                     radius=1.0,cadence_ms=cadence)
        for radius in (1, False, 0.0, -1.0, float('inf'), float('nan')):
            with self.subTest(radius=repr(radius)):
                with self.assertRaisesRegex(SphericalError, 'INVALID_NUMBER'):
                    runner.run_synthetic_geometry_v1(vectors(4), (0,1000,2000),
                                                     radius=radius,cadence_ms=1000)

    def test_dimension_mixed_or_unsupported(self):
        row = vectors(4)[0]
        with self.assertRaisesRegex(SphericalError, 'DIMENSION'):
            runner.run_synthetic_geometry_v1((row, (1.0, 2.0)), (0,1000),
                                             radius=1.0,cadence_ms=1000)
        with self.assertRaisesRegex(SphericalError, 'DIMENSION'):
            runner.run_synthetic_geometry_v1(((1.0, 0.0, 0.0),)*2, (0,1000),
                                             radius=1.0,cadence_ms=1000)

    def test_missing_c_dependency_fails_closed(self):
        with mock.patch.object(sphere, '_metric_core', None):
            with self.assertRaisesRegex(SphericalError, 'DEPENDENCY_UNAVAILABLE'):
                runner.run_synthetic_geometry_v1(vectors(4), (0,1000,2000),
                                                 radius=1.0,cadence_ms=1000)

    def test_256_4d_states_supported(self):
        row = vectors(4)[0]
        result = runner.run_synthetic_geometry_v1((row,) * 256, tuple(range(256)),
                                                 radius=1.0,cadence_ms=1)
        self.assertEqual(len(result['states']), 256)
        self.assertEqual(len(result['trajectory']['angles']), 255)
        self.assertEqual(result['trajectory']['speeds'], (0.0,) * 255)

    def test_declared_geometry_not_predictive(self):
        r = runner.run_synthetic_geometry_v1(vectors(4), (0,1000,2000),
                                              radius=1.0,cadence_ms=1000)
        self.assertTrue({'mode','qualified','authority','fit','reason'}.issubset(r))
        self.assertNotIn('profit',r)
        self.assertNotIn('winrate',r)
        self.assertNotIn('ranking',r)




# R18 actual real-V resource tests, not a simulated E-meter adapter.
from math_resource_budget import BudgetCounter, BudgetLimits
from math_universe_research_kernel import run_synthetic_geometry_v1, GeometryResultLease, _budget_quote

def rows(n,k):
    return tuple(tuple(1.0 if i==j%2 else 0.0 for i in range(n)) for j in range(k))

def clock(k):
    return tuple(i*1000 for i in range(k))

def limits(q,**change):
    x={"max_ops":q['ops'],"max_read_bytes":q['read_bytes'],
       "max_write_bytes":q['write_bytes'],"max_live_bytes":q['live_bytes'],
       "max_output_bytes":q['output_bytes']}
    x.update(change)
    return BudgetLimits(**x)


class ActualMeteredE(unittest.TestCase):
    def check_valid(self,n,k):
        q=_budget_quote(n,k)
        b=BudgetCounter(limits(q))
        with run_synthetic_geometry_v1(rows(n,k),clock(k),radius=2.0,cadence_ms=1000,budget=b) as lease:
            self.assertIsInstance(lease,GeometryResultLease)
            res=lease.result
            self.assertEqual(res['schema'],'math.universe.synthetic.geometry.v1')
            self.assertEqual(res['status'],'UNQUALIFIED')
            self.assertEqual(res['authority'],'NONE')
            self.assertFalse(res['qualified'])
            self.assertIsNone(res['fit'])
            self.assertEqual(len(res['states']),k)
            self.assertEqual(len(res['trajectory']['angles']),k-1)
            ss=b.snapshot()
            self.assertFalse(ss['failed'])
            self.assertEqual(ss['live_bytes'],q['retained'])
            self.assertLessEqual(ss['peak_bytes'],q['live_bytes'])
            for name in ('ops','read_bytes','write_bytes','output_bytes'):
                self.assertLessEqual(ss[name],q[name])
            self.assertEqual(ss['by_kind']['sample'],q['wrapper_ops'])
            self.assertEqual(ss['by_kind']['other'],q['core_ops'])
            self.assertGreater(ss['by_kind']['coordinate'],0)
            self.assertEqual(ss['output_bytes'],q['output_bytes'])
            if n==32 and k==256:
                self.assertEqual(ss['ops'],4207226880)
                self.assertEqual(ss['peak_bytes'],3738376)
                self.assertEqual(ss['output_bytes'],1152784)
        self.assertEqual(b.snapshot()['live_bytes'],0)
        with self.assertRaises(SphericalError):lease.release()
        return b.snapshot()

    def test_real_4d_2(self):self.check_valid(4,2)
    def test_real_4d_3(self):self.check_valid(4,3)
    def test_real_32d_3(self):self.check_valid(32,3)
    def test_real_32d_256(self):self.check_valid(32,256)

    def test_exact_five_quote_constants(self):
        self.assertEqual(tuple(_budget_quote(4,2)[x] for x in ('ops','read_bytes','write_bytes','live_bytes','output_bytes')),
                         (12792448,9952,10264,145816,2720))
        self.assertEqual(tuple(_budget_quote(32,256)[x] for x in ('ops','read_bytes','write_bytes','live_bytes','output_bytes')),
                         (5083811840,7883728,8282296,3738376,1152784))
        self.assertEqual(_budget_quote(32,256)['retained'],182728)
        self.assertEqual(_budget_quote(32,256)['intermediate'],622720)

    def test_five_one_below_denials_atomic(self):
        q=_budget_quote(4,3)
        for limits_key,cost_key in (("max_ops","ops"),("max_read_bytes","read_bytes"),
                                   ("max_write_bytes","write_bytes"),("max_live_bytes","live_bytes"),
                                   ("max_output_bytes","output_bytes")):
            with self.subTest(limits_key=limits_key):
                b=BudgetCounter(limits(q,**{limits_key:q[cost_key]-1}))
                with self.assertRaisesRegex(ValueError,'BUDGET_EXCEEDED'):
                    run_synthetic_geometry_v1(rows(4,3),clock(3),radius=2.0,cadence_ms=1000,budget=b)
                ss=b.snapshot()
                self.assertTrue(ss['failed'])
                self.assertEqual(tuple(ss[x] for x in ('ops','read_bytes','write_bytes','live_bytes','output_bytes')),(0,0,0,0,0))

    def test_invalid_shapes_never_consume_valid_budget(self):
        q=_budget_quote(4,3)
        b=BudgetCounter(limits(q))
        cases=[(rows(4,3), (0,1000,3000)),
               (rows(4,3)[:2]+((1.0,2.0),),clock(3)),
               (rows(4,3)[:2]+((1,2,3,4),),clock(3)),
               (list(rows(4,3)),clock(3))]
        for rr,tt in cases:
            with self.subTest(rr=type(rr).__name__):
                with self.assertRaises(ValueError):
                    run_synthetic_geometry_v1(rr,tt,radius=2.0,cadence_ms=1000,budget=b)
                ss=b.snapshot()
                self.assertFalse(ss['failed'])
                self.assertEqual(ss['ops'],0)
                self.assertEqual(ss['live_bytes'],0)

    def test_bad_counter_types_denied_without_object_callbacks(self):
        class Trapper:
            def __getattribute__(self,n):raise AssertionError('callback invoked')
        with self.assertRaisesRegex(SphericalError,'BUDGET_EXCEEDED'):
            run_synthetic_geometry_v1(rows(4,2),clock(2),radius=2.0,cadence_ms=1000,budget=Trapper())
        with self.assertRaisesRegex(SphericalError,'BUDGET_EXCEEDED'):
            spherical_apply('normalize',{'x':rows(4,2)[0]},3,2.0,budget=BudgetCounter(limits(_budget_quote(4,2))))

    def test_zero_direction_refusal_without_fictitious_trajectory(self):
        rr=(tuple(0.0 for _ in range(4)),rows(4,3)[1],rows(4,3)[2])
        q=_budget_quote(4,3);b=BudgetCounter(limits(q))
        lease=run_synthetic_geometry_v1(rr,clock(3),radius=2.0,cadence_ms=1000,budget=b)
        self.assertEqual(lease.result['reason'],'ZERO_DIRECTION')
        self.assertIsNone(lease.result['trajectory'])
        self.assertEqual(b.snapshot()['live_bytes'],q['retained'])
        lease.release()
        self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_c_denial_cleanup_no_partial_lease(self):
        # Real C may reject representable invalid numeric projection after
        # debit; reserve cleanup must occur and no result be exposed.
        q=_budget_quote(4,3);b=BudgetCounter(limits(q))
        rr=tuple((sys.float_info.max,sys.float_info.max,0.0,0.0) for _ in range(3))
        with self.assertRaises(ValueError):
            run_synthetic_geometry_v1(rr,clock(3),radius=2.0,cadence_ms=1000,budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_two_result_leases_shared_counter(self):
        q=_budget_quote(4,2)
        maxkw={"max_ops":2*q['ops'],"max_read_bytes":2*q['read_bytes'],
               "max_write_bytes":2*q['write_bytes'],"max_live_bytes":2*q['live_bytes'],
               "max_output_bytes":2*q['output_bytes']}
        b=BudgetCounter(BudgetLimits(**maxkw))
        a=run_synthetic_geometry_v1(rows(4,2),clock(2),radius=2.0,cadence_ms=1000,budget=b)
        first=b.snapshot()['ops']
        c=run_synthetic_geometry_v1(rows(4,2),clock(2),radius=2.0,cadence_ms=1000,budget=b)
        self.assertGreater(b.snapshot()['ops'],first)
        self.assertEqual(b.snapshot()['live_bytes'],2*q['retained'])
        a.release();c.release()
        self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_legacy_pure_byte_equivalent(self):
        rr=rows(4,3);t=clock(3)
        a=run_synthetic_geometry_v1(rr,t,radius=2.0,cadence_ms=1000)
        b=run_synthetic_geometry_v1(rr,t,radius=2.0,cadence_ms=1000,budget=None)
        self.assertEqual(a,b)
        self.assertIsInstance(a,dict)



class R20NewGeometryBudgetRegressions(unittest.TestCase):
    """New adversarial real-C/V cases only; no alternative geometry engine."""

    @staticmethod
    def _counter(n, k):
        q = _budget_quote(n, k)
        b = BudgetCounter(limits(q))
        return b, q

    def _compare(self, coordinates, radius=1.0):
        n, k = len(coordinates[0]), len(coordinates)
        stamps = tuple(i * 1000 for i in range(k))
        b, q = self._counter(n, k)
        error = None
        try:
            legacy = run_synthetic_geometry_v1(coordinates, stamps,
                                               radius=radius, cadence_ms=1000)
        except SphericalError as exc:
            error = exc.code
        try:
            lease = run_synthetic_geometry_v1(coordinates, stamps,
                                              radius=radius, cadence_ms=1000,
                                              budget=b)
        except SphericalError as exc:
            self.assertEqual(exc.code, error)
        else:
            self.assertIsNone(error)
            self.assertEqual(lease.result, legacy)
            self.assertLessEqual(b.snapshot()['ops'], q['ops'])
            self.assertLessEqual(b.snapshot()['read_bytes'], q['read_bytes'])
            self.assertLessEqual(b.snapshot()['write_bytes'], q['write_bytes'])
            self.assertLessEqual(b.snapshot()['peak_bytes'], q['live_bytes'])
            self.assertLessEqual(b.snapshot()['output_bytes'], q['output_bytes'])
            lease.release()
        self.assertEqual(b.snapshot()['live_bytes'], 0)
        self.assertIs(sphere._RUNNER_BUDGET.get(), None)
        return error

    def test_r20_new_40_non_axis_sparse_signed_scale_cases(self):
        for n in (4, 32):
            for k in (2, 3, 7, 32):
                for pattern in ('axis', 'dense', 'sparse', 'signed', 'small'):
                    rr = []
                    for j in range(k):
                        if pattern == 'axis':
                            row = [1.0 if x == j % n else 0.0 for x in range(n)]
                        elif pattern == 'dense':
                            row = [0.1 + x % 4 / 10 + j % 3 / 10 for x in range(n)]
                        elif pattern == 'sparse':
                            row = [1.0 if (x+j) % 3 == 0 else 0.0 for x in range(n)]
                        elif pattern == 'signed':
                            row = [(-1.0 if (x+j)%2 else 1.0)*(x+1)/n for x in range(n)]
                        else:
                            row = [0.25 if x == j%n else 0.125 if x == (j+1)%n else 0.0
                                   for x in range(n)]
                        rr.append(tuple(row))
                    with self.subTest(n=n, k=k, pattern=pattern):
                        self.assertIsNone(self._compare(tuple(rr)))

    def test_r20_new_numeric_refusals_max_subnormal_zero(self):
        for n in (4, 32):
            cases = (
                (sys.float_info.max, sys.float_info.max),
                (sys.float_info.max, math.ulp(0.0)),
                (math.ulp(0.0), 0.0),
                (2.0 ** -500, 2.0 ** -500),
                (0.0, 0.0),
                (1.0, math.ulp(0.0)),
            )
            for i, (a, b) in enumerate(cases):
                v = (a, b) + (0.0,) * (n-2)
                sequence = (v, v, v)
                with self.subTest(n=n, case=i):
                    error = self._compare(sequence)
                    if i == 0:
                        self.assertEqual(error, 'NUMERIC_OVERFLOW')
                    elif i == 2:
                        # A representable minimum-subnormal norm is not an underflow.
                        self.assertIsNone(error)

    def test_r20_new_full_256_dense_non_axis_real_c_v(self):
        import random
        rng = random.Random(202620)
        rr = tuple(tuple(float(rng.randrange(-2, 3)) / 4 for _ in range(32))
                   for _ in range(256))
        self.assertIsNone(self._compare(rr))

    def test_r20_new_retain_after_terminal_denial_and_scope_reset(self):
        q = _budget_quote(4, 2)
        # Exact enough for one invocation; too small for a second invocation.
        b = BudgetCounter(limits(q))
        lease = run_synthetic_geometry_v1(rows(4,2), clock(2), radius=2.0,
                                          cadence_ms=1000, budget=b)
        self.assertEqual(b.snapshot()['live_bytes'], q['retained'])
        with self.assertRaisesRegex(SphericalError, 'BUDGET_EXCEEDED'):
            run_synthetic_geometry_v1(rows(4,2), clock(2), radius=2.0,
                                      cadence_ms=1000, budget=b)
        self.assertTrue(b.snapshot()['failed'])
        self.assertIsNone(sphere._RUNNER_BUDGET.get())
        lease.release()
        self.assertEqual(b.snapshot()['live_bytes'], 0)
        self.assertIsNone(lease.result)


if __name__ == '__main__':
    unittest.main()
