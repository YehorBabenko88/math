"""Exact executed-volume aggregation, including hostile caller contexts.

Can run unchanged against the installed wheel with Python -I.
"""
from decimal import Decimal as D, Inexact, Rounded, ROUND_UP, localcontext
import unittest

from market_profile_math import aggregate_orderflow_stream, orderflow_volume_metrics


class OrderflowDecimalContext(unittest.TestCase):
    def test_exact_sums_delta_and_cumulative_with_caller_traps(self):
        for prec in (3, 5, 28, 96):
            for trap in (False, True):
                with self.subTest(prec=prec, trap=trap), localcontext() as ctx:
                    ctx.prec = prec
                    ctx.rounding = ROUND_UP
                    ctx.traps[Inexact] = ctx.traps[Rounded] = trap
                    ctx.clear_flags()
                    rows = [(60, D('1.009'), D('100.00001'), 'buy'),
                            (0, D('1.009'), D('0.00002'), 'sell'),
                            (60, D('1.009'), D('0.00002'), 'buy'),
                            (120, D('1.009'), D('7.000001'), 'unknown')]
                    got = aggregate_orderflow_stream(iter(rows), mode='time',
                        interval_ms=60, initial_delta=D('0.00000001'))
                    self.assertEqual([key for key, _ in got], [0, 60, 120])
                    self.assertEqual(got[0][1]['delta'], D('-0.00002'))
                    self.assertEqual(got[1][1]['buy_volume'], D('100.00003'))
                    self.assertEqual(got[1][1]['cumulative_delta'], D('100.00001001'))
                    self.assertEqual(got[2][1]['unknown_volume'], D('7.000001'))
                    self.assertIsNone(got[2][1]['imbalance'])
                    self.assertEqual(got[2][1]['cumulative_delta'], D('100.00001001'))
                    self.assertFalse(any(ctx.flags.values()))

    def test_price_floor_uses_exact_tick_index(self):
        for prec in (3, 5, 28):
            with self.subTest(prec=prec), localcontext() as ctx:
                ctx.prec = prec
                ctx.traps[Inexact] = ctx.traps[Rounded] = True
                got = aggregate_orderflow_stream(iter([
                    (0, D('1.009'), D('1'), 'buy'),
                    (1, D('1.0099'), D('2'), 'sell'),
                    (2, D('1.010'), D('1'), 'unknown')]),
                    mode='price', tick_size=D('0.001'))
                self.assertEqual([key for key, _ in got], [D('1.009'), D('1.010')])
                self.assertEqual(got[0][1]['delta'], D('-1'))
                self.assertEqual(got[0][1]['imbalance'],
                    D('-0.3333333333333333333333333333'))

    def test_batch_shares_exact_arithmetic_and_fixed_ratio_policy(self):
        with localcontext() as ctx:
            ctx.prec = 3
            ctx.traps[Inexact] = ctx.traps[Rounded] = True
            got = orderflow_volume_metrics([
                (D('1'), D('100.00001'), 'buy'),
                (D('1'), D('0.00002'), 'buy')])
            self.assertEqual(got['buy_volume'], D('100.00003'))
            ratio = orderflow_volume_metrics([
                (D('1'), D('2'), 'buy'), (D('1'), D('1'), 'sell')])
            self.assertEqual(ratio['imbalance'], D('0.3333333333333333333333333333'))

    def test_100000_events_preserve_per_price_distribution(self):
        for prec in (3, 5, 28):
            with self.subTest(prec=prec), localcontext() as ctx:
                ctx.prec = prec
                ctx.traps[Inexact] = ctx.traps[Rounded] = True
                def records():
                    for i in range(25_000):
                        yield (i, D('1.009'), D('100.00001'), 'buy')
                        yield (i, D('1.0099'), D('0.00002'), 'buy')
                        yield (i, D('1.010'), D('0.00003'), 'sell')
                        yield (i, D('1.0109'), D('0.00004'), 'unknown')
                got = aggregate_orderflow_stream(records(), mode='price', tick_size=D('0.001'))
                self.assertEqual([key for key, _ in got], [D('1.009'), D('1.010')])
                self.assertEqual([m['trade_count'] for _, m in got], [50_000, 50_000])
                self.assertEqual(got[0][1]['buy_volume'], D('2500000.75000'))
                self.assertEqual(got[1][1]['sell_volume'], D('0.75000'))
                self.assertEqual(got[1][1]['unknown_volume'], D('1.00000'))
                self.assertEqual(got[1][1]['cumulative_delta'], D('2500000'))

    def test_excessive_decimal_domain_refuses_before_scaling(self):
        for value in (D('1e1001'), D('1e-1001'), D('1' * 129), D('NaN'), D('Infinity')):
            for field in ('price', 'volume', 'tick', 'initial'):
                with self.subTest(value=value, field=field), self.assertRaises(ValueError):
                    aggregate_orderflow_stream(iter([(0,
                        value if field == 'price' else D('1'),
                        value if field == 'volume' else D('1'), 'buy')]),
                        mode='price', tick_size=value if field == 'tick' else D('1'),
                        initial_delta=value if field == 'initial' else D('0'))

    def test_extreme_supported_exponents_and_zero_floor_ignore_caller_range(self):
        with localcontext() as ctx:
            ctx.prec, ctx.Emin, ctx.Emax = 2, -9, 9
            for signal in ctx.traps:
                ctx.traps[signal] = True
            ctx.clear_flags()
            large = D('9' * 128 + 'e1000')
            tiny = D('1e-1000')
            got = orderflow_volume_metrics([
                (D('1'), large, 'buy'), (D('1'), tiny, 'buy'),
                (D('1'), large, 'sell')], initial_delta=D('-1e-1000'))
            self.assertEqual(got['delta'], tiny)
            self.assertEqual(got['cumulative_delta'], D('0'))
            floors = aggregate_orderflow_stream(iter([
                (0, tiny, D('1'), 'buy')]), mode='price', tick_size=large)
            self.assertEqual(floors[0][0], D('0'))
            self.assertFalse(any(ctx.flags.values()))


if __name__ == '__main__':
    unittest.main()
