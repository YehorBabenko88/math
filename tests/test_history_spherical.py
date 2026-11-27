"""A-v1 geometry developer tests only; independent expected-value custody is U."""
import math
import fractions
from unittest import mock
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import history_spherical as sphere
from history_spherical import spherical_apply, SphericalError


class _DeveloperOnlyMetricStub:
    """Test double for C's reviewed ABI, NOT C's kernel or an independent oracle.

    Solely used to exercise E geometry while the C development branch is absent.
    Integrated acceptance MUST rerun against exact C commit and independent U.
    """
    @staticmethod
    def _rounded(exact):
        try:
            out = float(exact)
        except OverflowError:
            raise ValueError('NUMERIC_OVERFLOW') from None
        if not math.isfinite(out):
            raise ValueError('NUMERIC_OVERFLOW')
        if exact != 0 and out == 0:
            raise ValueError('NUMERIC_UNDERFLOW')
        return out if out else 0.0

    @classmethod
    def checked_norm(cls, x):
        exact = sum((fractions.Fraction.from_float(z) ** 2 for z in x), fractions.Fraction(0))
        if exact > fractions.Fraction.from_float(sys.float_info.max)**2:
            raise ValueError('NUMERIC_OVERFLOW')
        return math.hypot(*x)

    @classmethod
    def checked_dot(cls, x, y):
        return cls._rounded(sum((fractions.Fraction.from_float(a)*fractions.Fraction.from_float(b)
                                for a,b in zip(x,y)),fractions.Fraction(0)))

    @classmethod
    def checked_distance(cls, x, y):
        exact = sum(((fractions.Fraction.from_float(a)-fractions.Fraction.from_float(b))**2
                     for a,b in zip(x,y)),fractions.Fraction(0))
        if exact > fractions.Fraction.from_float(sys.float_info.max)**2:
            raise ValueError('NUMERIC_OVERFLOW')
        return math.hypot(*(a-b for a,b in zip(x,y)))

    @classmethod
    def checked_mul(cls, a, b):
        return cls._rounded(fractions.Fraction.from_float(a)*fractions.Fraction.from_float(b))

    @classmethod
    def checked_div(cls, a, b):
        if b == 0:
            raise ValueError('ZERO_DIVISOR')
        return cls._rounded(fractions.Fraction.from_float(a)/fractions.Fraction.from_float(b))


class DependencyAdmissionTests(unittest.TestCase):
    def test_no_C_metric_core_fails_closed(self):
        with mock.patch.object(sphere, '_metric_core', None):
            with self.assertRaisesRegex(SphericalError, 'DEPENDENCY_UNAVAILABLE'):
                spherical_apply('normalize', {'x': (3.0,4.0,0.0)}, 2, 1.0)


def apply(op, args, d=2, r=1.0, *, budget=None):
    return spherical_apply(op, args, d, r, budget=budget)


class SphericalAContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # The exact C source may not exist yet on E's isolated branch.
        # Test E-only behaviour against a declared developer-only reference stub.
        # This is NEVER independent U qualification or exact C+E integration.
        cls._patcher = None
        if sphere._metric_core is None:
            cls._patcher = mock.patch.object(sphere, '_metric_core', _DeveloperOnlyMetricStub)
            cls._patcher.start()

    @classmethod
    def tearDownClass(cls):
        if cls._patcher is not None:
            cls._patcher.stop()

    def test_normalize_retains_raw_norm_and_direction(self):
        self.assertEqual(apply('normalize', {'x': (3.0, 4.0, 0.0)}),
                         {'rho': 5.0, 'u': (.6, .8, 0.0)})

    def test_zero_vector_has_no_direction(self):
        self.assertEqual(apply('normalize', {'x': (0.0, 0.0, 0.0)}),
                         {'rho': 0.0, 'u': None})

    def test_zero_direction_cannot_be_geodesic(self):
        with self.assertRaisesRegex(SphericalError, 'ZERO_DIRECTION'):
            apply('geodesic', {'u': (0.0, 0.0, 0.0), 'v': (1.0, 0.0, 0.0)})

    def test_geodesic_quarter_arc(self):
        result = apply('geodesic', {'u': (1.0, 0.0, 0.0),
                                    'v': (0.0, 1.0, 0.0)}, r=2.0)
        self.assertAlmostEqual(result['angle'], math.pi/2)
        self.assertAlmostEqual(result['distance'], math.pi)

    def test_log_uses_angular_tangent_not_arc(self):
        t = apply('log', {'u': (1.0, 0.0, 0.0), 'v': (0.0, 1.0, 0.0)}, r=2.0)
        self.assertAlmostEqual(t['tangent'][1], math.pi/2)
        out = apply('exp', {'u': (1.0, 0.0, 0.0), 'tangent': t['tangent']}, r=2.0)
        self.assertAlmostEqual(out['u'][0], 0.0, places=12)
        self.assertAlmostEqual(out['u'][1], 1.0, places=12)

    def test_antipodal_log_refused(self):
        with self.assertRaisesRegex(SphericalError, 'ANTIPODAL_AMBIGUITY'):
            apply('log', {'u': (1.0, 0.0, 0.0), 'v': (-1.0, 0.0, 0.0)})

    def test_near_antipode_refused(self):
        with self.assertRaisesRegex(SphericalError, 'CUT_LOCUS'):
            apply('log', {'u': (1.0, 0.0, 0.0), 'v': (-1.0, 1e-9, 0.0)})

    def test_exp_principal_radius_pi_refused(self):
        with self.assertRaisesRegex(SphericalError, 'CUT_LOCUS'):
            apply('exp', {'u': (1.0, 0.0, 0.0), 'tangent': (0.0, math.pi, 0.0)})
        below = apply('exp', {'u': (1.0, 0.0, 0.0),
                              'tangent': (0.0, math.nextafter(math.pi, 0), 0.0)})
        self.assertTrue(all(math.isfinite(v) for v in below['u']))

    def test_exact_overflow_norm_hidden_by_hypot_rounding(self):
        m, delta = sys.float_info.max, math.ulp(0.0)
        self.assertEqual(apply('normalize', {'x': (m, 0.0, 0.0)})['rho'], m)
        with self.assertRaisesRegex(SphericalError, 'NUMERIC_OVERFLOW'):
            apply('normalize', {'x': (m, delta, 0.0)})

    def test_tiny_direction_nonzero_underflow_refused(self):
        delta = math.ulp(0.0)
        with self.assertRaisesRegex(SphericalError, 'NUMERIC_UNDERFLOW'):
            apply('geodesic', {'u': (1.0, 0.0, 0.0), 'v': (1.0, delta, 0.0)})

    def test_near_equal_resolved(self):
        result = apply('geodesic', {'u': (1.0, 0.0, 0.0),
                                    'v': (1.0, 1e-9, 0.0)})
        self.assertGreater(result['angle'], 0.0)
        self.assertAlmostEqual(result['angle'], 1e-9, delta=1e-18)

    def test_tangent_without_unnecessary_norm(self):
        v = (0.0, 1.7e308, 1.7e308)
        self.assertEqual(apply('tangent', {'u': (1.0, 0.0, 0.0), 'v': v}),
                         {'tangent': v})

    def test_tangent_radial_returns_zero(self):
        self.assertEqual(apply('tangent', {'u': (1.0, 0.0, 0.0),
                                           'v': (1e308, 0.0, 0.0)}),
                         {'tangent': (0.0, 0.0, 0.0)})

    def test_tangent_nonzero_component_loss_refused(self):
        with self.assertRaisesRegex(SphericalError, 'NUMERIC_UNDERFLOW'):
            apply('tangent', {'u': (1.0, 0.0, 0.0),
                               'v': (1e308, math.ulp(0.0), 0.0)})

    def test_sphere_one_and_high_dimensional(self):
        self.assertEqual(apply('normalize', {'x': (3.0, 4.0)}, d=1)['rho'], 5.0)
        self.assertEqual(apply('normalize', {'x': (1.0,) * 256}, d=255)['rho'], 16.0)
        with self.assertRaisesRegex(SphericalError, 'DIMENSION'):
            apply('normalize', {'x': (1.0,) * 257}, d=256)

    def test_radius_positive_and_tiny_arc_underflow(self):
        u, v = (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)
        self.assertAlmostEqual(apply('geodesic', {'u': u, 'v': v}, r=2.0)['distance'], math.pi)
        with self.assertRaisesRegex(SphericalError, 'INVALID_NUMBER'):
            apply('geodesic', {'u': u, 'v': v}, r=0.0)
        with self.assertRaisesRegex(SphericalError, 'NUMERIC_UNDERFLOW'):
            apply('geodesic', {'u': u, 'v': (1.0, 1e-9, 0.0)}, r=math.ulp(0.0))

    def test_strict_trajectory_angles_distances_speeds(self):
        result = apply('trajectory', {
            'directions': [(1.0, 0.0, 0.0), (0.0, 1.0, 0.0)],
            'event_ms': [1000, 2000], 'cadence_ms': 1000,
        }, r=2.0)
        self.assertEqual(set(result), {'angles', 'distances', 'speeds'})
        self.assertAlmostEqual(result['angles'][0], math.pi/2)
        self.assertAlmostEqual(result['distances'][0], math.pi)
        self.assertAlmostEqual(result['speeds'][0], math.pi)

    def test_strict_trajectory_gap_refused(self):
        with self.assertRaisesRegex(SphericalError, 'CADENCE'):
            apply('trajectory', {
                'directions': [(1.0, 0.0, 0.0), (0.0, 1.0, 0.0)],
                'event_ms': [1000, 3000], 'cadence_ms': 1000,
            })

    def test_strict_trajectory_zero_refused(self):
        with self.assertRaisesRegex(SphericalError, 'ZERO_DIRECTION'):
            apply('trajectory', {
                'directions': [(1.0, 0.0, 0.0), (0.0, 0.0, 0.0)],
                'event_ms': [1000, 2000], 'cadence_ms': 1000,
            })

    def test_closed_dispatch_and_no_budget_authority(self):
        with self.assertRaisesRegex(SphericalError, 'INVALID_OPERATION'):
            apply('decode', {'rho': 5.0, 'u': (.6, .8, 0.0)})
        with self.assertRaisesRegex(SphericalError, 'BUDGET_EXCEEDED'):
            apply('normalize', {'x': (1.0, 0.0, 0.0)}, budget=object())


    def test_subnormal_direction_is_not_identical_to_axis(self):
        delta = math.ulp(0.0)
        result = apply('normalize', {'x': (1.0, delta, 0.0)})
        self.assertEqual(result['rho'], 1.0)
        self.assertEqual(result['u'][1], delta)
        self.assertNotEqual(result['u'], (1.0, 0.0, 0.0))

    def test_component_loss_after_admissible_scalar_norm(self):
        with self.assertRaisesRegex(SphericalError, 'NUMERIC_UNDERFLOW'):
            apply('normalize', {'x': (1e308, 1e-300, 0.0)})

    def test_identical_geodesic_zero_arc(self):
        result = apply('geodesic', {
            'u': (1.0, 0.0, 0.0), 'v': (1.0, 0.0, 0.0)
        }, r=2.0)
        self.assertEqual(result, {'angle': 0.0, 'distance': 0.0})

if __name__ == '__main__':
    unittest.main()
