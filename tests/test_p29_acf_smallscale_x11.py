"""Round29: exact rational ACF oracle vs CURRENT X11 implementation.

RED tests intentionally enforce scale invariance: no workaround or fake library.
Actual history_timeseries.py must have the pinned X11 Git blob SHA.
"""
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
from history_timeseries import acf
from scientific_memory import build_record, digest, qualify_historical_record


def rational_acf(values, max_lag=2):
    numbers = [Fraction(Decimal(str(x))) for x in values]
    average = sum(numbers) / len(numbers)
    centered = [x-average for x in numbers]
    denominator = sum(x*x for x in centered)
    if denominator == 0:
        raise ValueError('exact ACF undefined for constant sequence')
    return [Fraction(1)] + [
        sum(centered[i]*centered[i-lag] for i in range(lag,len(centered)))/denominator
        for lag in range(1,max_lag+1)
    ]


def pattern(scale):
    a = Decimal(str(scale))
    return [a, -a, a, -a]


class X11ACFSmallScaleOracle(unittest.TestCase):
    def assert_oracle(self, scale):
        values = pattern(scale)
        expected = rational_acf(values)
        self.assertEqual(expected, [Fraction(1), Fraction(-3,4), Fraction(1,2)])
        actual = acf(values, max_lag=2)
        self.assertEqual(len(actual), 3)
        for lag, (v, e) in enumerate(zip(actual, expected)):
            with self.subTest(scale=str(scale), lag=lag):
                self.assertAlmostEqual(v, float(e), delta=1e-12)

    def test_control_unit_amplitude(self):
        self.assert_oracle(1)

    def test_control_moderate_amplitude(self):
        self.assert_oracle(Decimal('0.000001'))

    def test_red_positive_1e_minus_10(self):
        self.assert_oracle(Decimal('1e-10'))

    def test_red_positive_1e_minus_12(self):
        self.assert_oracle(Decimal('1e-12'))

    def test_red_negative_1e_minus_10(self):
        self.assert_oracle(Decimal('-1e-10'))

    def test_red_scale_equivariance(self):
        base = acf(pattern(Decimal('1')), max_lag=2)
        tiny = acf(pattern(Decimal('1e-10')), max_lag=2)
        self.assertEqual(base, tiny)

    def test_record_preserves_inaccuracy_and_uses_exact_decision(self):
        closes = ('10', '10.0000000001', '10', '10.0000000001', '10')
        rows = [[str(i*60000), px, px, px, px, '1.0000', '1.00']
                for i, px in reversed(list(enumerate(closes,1)))]
        record = build_record('BTCUSDT', rows, digest(rows), 'at_most', '-0.5')
        self.assertEqual(record['status'], 'reproduced')
        self.assertEqual(record['result']['exact_reference'], ['1', '-3/4', '1/2'])
        self.assertEqual(record['result']['acf'], [1.0, 0.0, 0.0])  # characterization, NOT approval
        self.assertEqual(record['result']['absolute_error'], ['0', '3/4', '1/2'])
        self.assertEqual(record['result']['decision_basis'], 'exact_reference_lag_1')
        q = qualify_historical_record(record)
        self.assertEqual(q['source_authenticity'], 'UNATTESTED')
        self.assertIs(q['execution_authority'], False)
        self.assertIs(q['trading_authorized'], False)

    def test_rational_reference_requires_nonconstant_input(self):
        with self.assertRaisesRegex(ValueError, 'undefined'):
            rational_acf([Decimal('1')]*4)


if __name__ == '__main__':
    unittest.main(verbosity=2)
