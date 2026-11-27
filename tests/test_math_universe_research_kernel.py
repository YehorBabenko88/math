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
from history_spherical import SphericalError


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


if __name__ == '__main__':
    unittest.main()
