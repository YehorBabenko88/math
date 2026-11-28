"""Independent ACF oracle on represented finite binary64 samples; no DB or network."""
import math
import sys
import unittest
from fractions import Fraction
from history_timeseries import acf


def oracle(values, lag):
    # Exact scaled centering: z_i = n*x_i - sum(x). No rounded mean.
    x = tuple(Fraction.from_float(v) for v in values)
    n = len(x)
    z = tuple(n*v - sum(x) for v in x)
    den = sum(v*v for v in z)
    if not den:
        raise ValueError('constant')
    return [Fraction(1)] + [sum(z[t]*z[t-h] for t in range(h,n))/den
                            for h in range(1,min(lag,n-1)+1)]


class IndependentACF(unittest.TestCase):
    def check(self, x, lag=20):
        x = tuple(map(float, x))
        expect = oracle(x,lag)
        actual = acf(x,lag)
        self.assertEqual(len(actual),len(expect))
        for h,(a,e) in enumerate(zip(actual,expect)):
            with self.subTest(lag=h):
                self.assertTrue(math.isfinite(a), (x,h,a))
                self.assertAlmostEqual(a,float(e),delta=2e-15,
                                       msg=f'lag={h} reference={e}, actual={a}')
    def test_asymmetric_lag_convention(self):
        self.check((0,1,4,-2,3,-1),9)
    def test_translated_rounding_of_mean(self):
        b=2.**52
        self.check((b,b,b+1),2)
    def test_adjacent_subnormal_values(self):
        t=math.ulp(0.)
        self.check((0.,t,3*t,-t,2*t),4)
    def test_maximal_finite_mixed_sign(self):
        m=sys.float_info.max
        self.check((m,-m,m/2,-m/4,0.),4)
    def test_asymmetric_large_exponent_spread(self):
        self.check(tuple(math.ldexp(v,900) for v in (0.,1.,4.,-2.,3.,-1.)),4)
    def test_asymmetric_tiny_exponent_spread(self):
        self.check(tuple(math.ldexp(v,-900) for v in (0.,1.,4.,-2.,3.,-1.)),4)
    def test_constant_short_and_zero_lag_controls(self):
        self.assertEqual(acf([2.,2.,2.],20),[1.,0.,0.])
        self.assertEqual(acf([2.,3.],1),[])
        self.assertEqual(acf([2.,3.,4.],0),[1.])

if __name__ == '__main__': unittest.main(verbosity=2)
