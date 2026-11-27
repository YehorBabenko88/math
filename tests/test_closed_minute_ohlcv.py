"""Exact, bounded closed-minute math kernel: no source/trading authority."""
from decimal import Decimal
import unittest

from market_math import aggregate_closed_minute_ohlcv


def minute(open_, high, low, close, buy, sell):
    return tuple(Decimal(str(value)) for value in (
        open_, high, low, close, buy, sell
    ))


class ClosedMinuteOHLCVTests(unittest.TestCase):
    def test_open_high_low_close_and_exact_directional_volume(self):
        rows = [
            minute("10", "12", "9", "11", ".1", ".2"),
            minute("11", "13", "10", "12", ".3", ".4"),
            minute("12", "12.5", "10.5", "11.5", ".1", ".2"),
        ]
        self.assertEqual(
            aggregate_closed_minute_ohlcv(rows),
            (Decimal("10"), Decimal("13"), Decimal("9"),
             Decimal("11.5"), Decimal("1.3"))
        )
        self.assertEqual(
            aggregate_closed_minute_ohlcv([rows[0]]),
            (Decimal("10"), Decimal("12"), Decimal("9"),
             Decimal("11"), Decimal(".3"))
        )

    def test_no_implicit_casts_negative_or_nan(self):
        good = minute("10", "11", "9", "10", "1", "2")
        invalid = [
            [], [good] * 76, ("not a row",),
            [good[:5]], [good[:5] + (1.0,)],
            [minute("10", "11", "9", "10", "-1", "2")],
            [minute("10", "11", "9", "10", "1", "-2")],
            [minute("10", "9", "8", "10", "1", "2")],
            [minute("10", "11", "9", "10", "NaN", "2")],
            [minute("10", "11", "9", "10", "1", "Infinity")],
        ]
        for rows in invalid:
            with self.subTest(rows=str(rows)[:100]):
                with self.assertRaises(ValueError):
                    aggregate_closed_minute_ohlcv(rows)

    def test_explicitly_bounded_seventy_five_minute_rows(self):
        row = minute("2", "2", "2", "2", ".01", ".02")
        result = aggregate_closed_minute_ohlcv([row] * 75)
        self.assertEqual(result, (
            Decimal("2"), Decimal("2"), Decimal("2"),
            Decimal("2"), Decimal("2.25")
        ))


if __name__ == "__main__":
    unittest.main()
