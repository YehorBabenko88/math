"""C developer regression tests; U's independent oracle remains separate."""
import math
from fractions import Fraction
from pathlib import Path
import struct
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
from history_metric_core import (_sqrt_exact, checked_norm, checked_dot, checked_distance,
                                 checked_mul, checked_div, binary64_be_hex)


class StrictMetricTests(unittest.TestCase):
    def test_exact_345(self):
        self.assertEqual(checked_norm([3.0, 4.0]), 5.0)
        self.assertEqual(checked_dot([3.0, 4.0], [4.0, -3.0]), 0.0)
        self.assertEqual(checked_distance([0.0, 0.0], [3.0, 4.0]), 5.0)

    def test_extreme_exact_cancellation(self):
        m = sys.float_info.max
        self.assertEqual(checked_dot([m, m], [m, -m]), 0.0)
        self.assertEqual(checked_distance([m], [m]), 0.0)
        with self.assertRaisesRegex(ValueError, "NUMERIC_OVERFLOW"):
            checked_dot([m], [m])
        with self.assertRaisesRegex(ValueError, "NUMERIC_OVERFLOW"):
            checked_distance([m], [-m])

    def test_exact_norm_bound_not_rounded_max(self):
        m = sys.float_info.max
        self.assertEqual(checked_norm([m]), m)
        with self.assertRaisesRegex(ValueError, "NUMERIC_OVERFLOW"):
            checked_norm([m, 1.0])

    def test_tiny_nonzero_and_underflow(self):
        smallest = math.ulp(0.0)
        self.assertEqual(checked_norm([smallest]), smallest)
        self.assertEqual(checked_distance([0.0], [smallest]), smallest)
        with self.assertRaisesRegex(ValueError, "NUMERIC_UNDERFLOW"):
            checked_mul(smallest, 0.5)
        with self.assertRaisesRegex(ValueError, "NUMERIC_UNDERFLOW"):
            checked_div(smallest, 2.0)

    def test_strict_binary64_types(self):
        for invalid in (True, 1, "1", None, math.inf, -math.inf, math.nan):
            with self.subTest(invalid=repr(invalid)):
                with self.assertRaisesRegex(ValueError, "INVALID_NUMBER"):
                    checked_norm([invalid])
        for invalid in ([], list(range(257)), [0.0] * 257):
            with self.assertRaises(ValueError):
                checked_norm(invalid)
        with self.assertRaisesRegex(ValueError, "DIMENSION"):
            checked_distance([1.0], [1.0, 2.0])

    def test_scalar_arithmetic(self):
        self.assertEqual(checked_mul(0.5, 0.25), 0.125)
        self.assertEqual(checked_div(1.0, 4.0), 0.25)
        with self.assertRaisesRegex(ValueError, "ZERO_DIVISOR"):
            checked_div(1.0, -0.0)
        self.assertEqual(binary64_be_hex(-0.0), "0000000000000000")
        self.assertEqual(binary64_be_hex(5.0), struct.pack(">d", 5.0).hex())

    def test_exact_midpoint_ties_to_even(self):
        low = 1.0
        high = math.nextafter(low, math.inf)
        mid = (Fraction.from_float(low) + Fraction.from_float(high)) / 2
        self.assertEqual(_sqrt_exact(mid * mid), low)
        low2 = high
        high2 = math.nextafter(low2, math.inf)
        mid2 = (Fraction.from_float(low2) + Fraction.from_float(high2)) / 2
        self.assertEqual(_sqrt_exact(mid2 * mid2), high2)

    def test_rounds_to_nonzero_subnormal_and_refuses_zero(self):
        minimum = math.ulp(0.0)
        self.assertEqual(checked_mul(minimum, 0.75), minimum)
        with self.assertRaisesRegex(ValueError, "NUMERIC_UNDERFLOW"):
            checked_mul(minimum, 0.25)

    def test_budget_fail_closed_in_pure_slice(self):
        with self.assertRaisesRegex(ValueError, "BUDGET_EXCEEDED"):
            checked_norm([1.0], budget=object())


if __name__ == "__main__":
    unittest.main()
