"""Pure Math ownership of minute, footprint, tape and book quantities."""
from decimal import Decimal as D, Inexact, Rounded, localcontext
import unittest
from market_profile_math import (minute_volume_update, footprint_cell_update,
    exact_sum, wall_notional, executed_volume_delta, tick_distance, within_tick_distance, volume_profile_poc, price_bucket,
    book_summary_metrics, tape_velocity_metrics, flow_window_metrics,
    wall_turnover_ratios)

class MarketAnalyticsContract(unittest.TestCase):
    def test_minute_accumulation_is_exact_under_caller_traps(self):
        for precision in (3, 5, 28):
            with self.subTest(precision=precision), localcontext() as ctx:
                ctx.prec=precision
                ctx.traps[Inexact]=ctx.traps[Rounded]=True
                totals=(D(0),)*5
                totals=minute_volume_update(*totals,D('1.009'),D('100.00001'),'Buy')
                totals=minute_volume_update(*totals,D('1.009'),D('0.00002'),'1')
                self.assertEqual(totals,(D('100.00003'),D('100.90003027'),D('100.00003'),D(0),D('100.00003')))
                totals=minute_volume_update(*totals,D('1.009'),D('0.00003'),'unknown')
                self.assertEqual(totals[0],D('100.00006'))
                self.assertEqual(totals[2],D('100.00003'))

    def test_footprint_sum_delta_and_notional_are_exact(self):
        with localcontext() as ctx:
            ctx.prec=3
            ctx.traps[Inexact]=ctx.traps[Rounded]=True
            buy,sell=footprint_cell_update(D('100.00001'),D('0.00001'),D('0.00002'),'Buy')
            self.assertEqual((buy,sell),(D('100.00003'),D('0.00001')))
            self.assertEqual(executed_volume_delta(buy,sell),D('100.00002'))
            self.assertEqual(exact_sum(iter([buy,sell,D('-100')])),D('0.00004'))
            self.assertEqual(wall_notional(D('1.009'),buy),D('100.90003027'))
            self.assertFalse(any(ctx.flags.values()))

    def test_distance_book_and_flow_ratios_ignore_precision_and_exponent_limits(self):
        for precision in (3,28):
            with self.subTest(precision=precision),localcontext() as ctx:
                ctx.prec=precision;ctx.Emin=-2;ctx.Emax=2
                ctx.traps[Inexact]=ctx.traps[Rounded]=True
                self.assertEqual(tick_distance(D('1.009'),D('1'),D('0.003')),D('3'))
                self.assertEqual(tick_distance(D('1'),D('2'),D('3')),D('0.3333333333333333333333333333'))
                self.assertEqual(book_summary_metrics({D('1.009'):D('100.00003')},{D('1.010'):D('2')},D('0.001')),
                    (D('1.009'),D('1.010'),D('0.001'),D('100.90003027'),D('2.020')))
                flow=flow_window_metrics([(0,D('100.00001'),'buy'),(1,D('0.00002'),'sell')],1,60)
                self.assertEqual(flow['turnover_usd'],D('100.00003'))
                self.assertEqual(flow['trades_per_second'],D('0.03333333333333333333333333333'))
                ratios=wall_turnover_ratios(D('1'),D('1'),{60:D('3')})
                self.assertEqual(ratios['ratios'][60],D('0.3333333333333333333333333333'))
                self.assertFalse(any(ctx.flags.values()))

    def test_rounded_display_distance_cannot_admit_outside_tick_boundary(self):
        price=D('1.00900000000000000000000000000000000000000001')
        self.assertEqual(tick_distance(price,D('1'),D('0.001')),D('9'))
        self.assertFalse(within_tick_distance(price,D('1'),D('0.001'),D('9')))
        self.assertTrue(within_tick_distance(D('1.009'),D('1'),D('0.001'),D('9')))

    def test_tape_preserves_exact_quantities_at_boundary(self):
        with localcontext() as ctx:
            ctx.prec=3;ctx.traps[Inexact]=ctx.traps[Rounded]=True
            got=tape_velocity_metrics([(0,D('1.009'),D('100.00001'),'Buy'),
                (1,D('1.009'),D('0.00002'),'Buy')],D('1'),D('0.001'),1000,D('9'),1,
                observed_price=D('1.009'))
            self.assertEqual(got,(D('2'),D('100.90003027'),D('100.90003027'),D('0'),D('9')))

    def test_explicit_half_even_bucket_preserves_data_builder_tie_policy(self):
        self.assertEqual(price_bucket(D('2.5'),D('1')),D('3'))
        self.assertEqual(price_bucket(D('2.5'),D('1'),rounding='half_even'),D('2'))
        self.assertEqual(price_bucket(D('3.5'),D('1'),rounding='half_even'),D('4'))
        with self.assertRaises(ValueError):price_bucket(D('2.5'),D('1'),rounding='floor')

    def test_first_seen_poc_tie_policy_preserves_original_data_builder(self):
        profile={D('101'):D('2'),D('100'):D('2')}
        self.assertEqual(volume_profile_poc(profile),D('100'))
        self.assertEqual(volume_profile_poc(profile,tie_policy='first_seen'),D('101'))
        with self.assertRaises(ValueError):volume_profile_poc(profile,close=D('100'),tie_policy='first_seen')
        with self.assertRaises(ValueError):volume_profile_poc(profile,tie_policy='random')

    def test_nonfinite_oversized_and_wrong_side_refuse(self):
        for bad in (D('NaN'),D('Infinity'),D('-1'),D('1e1001'),D('1'*129)):
            with self.subTest(bad=bad),self.assertRaises(ValueError):
                minute_volume_update(*(D(0),)*5,D('1'),bad,'buy')
        with self.assertRaises(ValueError):footprint_cell_update(D(0),D(0),D(1),'unknown')
        with self.assertRaises(ValueError):tick_distance(D(1),D(2),D(0))
        with self.assertRaises(ValueError):book_summary_metrics({D(2):D(1)},{D(1):D(1)},D('0.01'))
        with self.assertRaises(ValueError):exact_sum([D('NaN')])
        self.assertEqual(book_summary_metrics({}, {},D('0.01')),(None,None,None,D(0),D(0)))

if __name__=='__main__':unittest.main()
