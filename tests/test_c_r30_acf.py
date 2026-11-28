"""Owner tests: exact represented-float ACF, no DB/network or second runtime."""
from decimal import Decimal
from fractions import Fraction
import math
import random
import sys
import unittest
from history_timeseries import acf, pair_error_correction
from scientific_memory import build_record, digest, qualify_historical_record


def oracle(values, max_lag=20):
    # Independent Fraction reference, using exact binary64 samples, not the
    # production common-denominator integer implementation.
    f = [Fraction.from_float(float(v)) for v in values]
    n = len(f)
    mean = sum(f) / n
    y = [v-mean for v in f]
    den = sum(v*v for v in y)
    if not den:
        raise ValueError('constant')
    return [Fraction(1)] + [sum(a*b for a,b in zip(y[h:],y))/den
                            for h in range(1, min(max_lag,n-1)+1)]


class ACFNumericalContract(unittest.TestCase):
    def check_oracle(self, x, lag=20):
        expected = oracle(x, lag)
        actual = acf(x, lag)
        self.assertEqual(actual, list(map(float, expected)))
        self.assertTrue(all(math.isfinite(v) and abs(v)<=1 for v in actual))

    def test_ordinary_nonzero_mean_and_lag_normalization(self):
        for x in ([1., 4., -2., 7., 5.], [1., 2., 3.], [1., -1., 1., -1.]):
            self.check_oracle(x, 99)
            self.check_oracle(x, 0)
        self.assertEqual(acf([1.,-1.,1.,-1.], -1), [1.])
        self.assertEqual(acf([1.,2.,3.], 1.9), acf([1.,2.,3.], 1))

    def test_scale_sign_powers_of_two_extreme_binary64(self):
        base = [1., -1., 1., -1.]
        for exp in (-1074,-1073,-1022,-500,-100,-30,0,100,500,1023):
            for sign in (-1.,1.):
                with self.subTest(exp=exp,sign=sign):
                    x=[math.ldexp(v*sign,exp) for v in base]
                    self.assertEqual(acf(x,2), [1.,-.75,.5])
                    self.check_oracle(x,2)
        m=sys.float_info.max
        self.check_oracle([m,-m,m,-m],3)

    def test_translation_and_adjacent_max_floats(self):
        # Translation exactly representable in binary64.
        x=[1., 3., 7., 2.]
        self.assertEqual(acf(x), acf([v+2**40 for v in x]))
        m=sys.float_info.max
        self.check_oracle([m,math.nextafter(m,0.),m,math.nextafter(m,0.)],3)
        a=1e308; b=math.nextafter(a,math.inf)
        self.check_oracle([a,b,a,b],3)

    def test_mixed_extremes_and_exact_zero(self):
        m=sys.float_info.max
        self.check_oracle([m,0.,-m],2)
        self.assertEqual(acf([m,0.,-m],1), [1.,0.])
        self.check_oracle([m,math.ulp(0.),m,-m],3)
        # This second mixed-scale input has exact nonzero coefficients that
        # cannot be represented as nonzero binary64; refusal is mandatory.
        x=[m,math.ulp(0.),0.,-m]
        self.assertTrue(any(v and float(v)==0. for v in oracle(x,3)))
        with self.assertRaisesRegex(ValueError,'ACF_RESULT_UNDERFLOW'):
            acf(x,3)

    def test_nonzero_coefficient_underflow_refuses(self):
        x=[sys.float_info.max,math.ulp(0.),-sys.float_info.max]
        ref=oracle(x,1)[1]
        self.assertNotEqual(ref,0)
        self.assertEqual(float(ref),0.)
        with self.assertRaisesRegex(ValueError,'ACF_RESULT_UNDERFLOW'):
            acf(x,1)

    def test_nonfinite_invalid_projection(self):
        for x in (float('nan'), float('inf'), -float('inf'), Decimal('Infinity'),
                  Decimal('NaN'), Decimal('sNaN'), Decimal('1e10000'),10**400,'nonnumeric'):
            with self.subTest(value=str(x)), self.assertRaisesRegex(ValueError,'ACF_FINITE_BINARY64_REQUIRED'):
                acf([1., x, 2.],2)
        with self.assertRaisesRegex(ValueError,'ACF_FINITE_BINARY64_REQUIRED'):
            acf([float('nan')])

    def test_projection_underflow_and_collision(self):
        for x in (Decimal('1e-1000'), Decimal('-1e-1000'), Fraction(1,10**400),'1e-1000'):
            with self.subTest(value=str(x)), self.assertRaisesRegex(ValueError,'ACF_PROJECTION_UNDERFLOW'):
                acf([0.,x,1.],2)
        for seq in ([2**53,2**53+1,2**53],
                    [Decimal('1'),Decimal('1.0000000000000000001'),Decimal('2')],
                    ['1','1.00000000000000000001','2']):
            with self.subTest(seq=str(seq)), self.assertRaisesRegex(ValueError,'ACF_PROJECTION_COLLISION'):
                acf(seq,2)
        self.assertEqual(acf(['1','1.0','1.00'],2),[1.,0.,0.])

    def test_short_constant_signed_zero_and_invalid_lag(self):
        for x in ([],[1.],[1.,2.]):
            self.assertEqual(acf(x),[])
        for x in ([1.]*4,[0.,-0.,0.], [sys.float_info.max]*3, [math.ulp(0.)]*4):
            self.assertEqual(acf(x,2),[1.,0.,0.])
            self.assertEqual(acf(x,-2),[1.])
        for lag in (float('nan'),float('inf'),None):
            with self.subTest(lag=lag), self.assertRaisesRegex(ValueError,'ACF_INVALID_LAG'):
                acf([1,2,3],lag)

    def test_seeded_independent_fraction_oracle(self):
        rng=random.Random(29030)
        for _ in range(200):
            n=rng.randrange(3,17)
            # Integral dyadics at a common scale, plus nontrivial means/lags.
            e=rng.randrange(-1000,980)
            x=[math.ldexp(rng.randint(-100,100),e) for _ in range(n)]
            if len(set(x))==1:
                continue
            self.check_oracle(x,rng.randrange(1,n+1))

    def test_pair_error_correction_actual_consumer(self):
        x=[-1.,-1.,1.,1.]*8
        for a in (1.,1e-10,1e-150):
            residual=[a,-a,a,-a]*8
            r=pair_error_correction(x,residual)
            self.assertIsNotNone(r)
            self.assertEqual(r['alpha'],0.)
            self.assertEqual(r['beta'],0.)
            self.assertEqual(r['residual_lag1_acf'], float(oracle(residual,1)[1]))
        self.assertIsNone(pair_error_correction([1.]*30,[2.]*30))
        self.assertIsNone(pair_error_correction([1.,2.],[2.,3.]))

    def test_record_actual_small_scale_and_denial(self):
        closes=('10','10.0000000001','10','10.0000000001','10')
        rows=[[str(i*60000),px,px,px,px,'1','1']
              for i,px in reversed(list(enumerate(closes,1)))]
        r=build_record('BTCUSDT',rows,digest(rows),'at_most','-0.5')
        self.assertEqual(r['result']['acf'],[1.,-.75,.5])
        self.assertEqual(r['result']['exact_reference'],['1','-3/4','1/2'])
        self.assertEqual(r['result']['absolute_error'],['0','0','0'])
        self.assertEqual(r['status'],'reproduced')
        q=qualify_historical_record(r)
        self.assertEqual(q['source_authenticity'],'UNATTESTED')
        self.assertIs(q['trading_authorized'],False)
        self.assertIs(q['execution_authority'],False)
        rows=[[str(i*60000),str(i),str(i),str(i),str(i),'1','1']
              for i in range(5,0,-1)]
        with self.assertRaisesRegex(ValueError,'Undefined normalized autocorrelation'):
            build_record('BTCUSDT',rows,digest(rows),'at_most','-0.5')

if __name__=='__main__':
    unittest.main(verbosity=2)
