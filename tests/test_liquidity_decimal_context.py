"""Independent literal liquidity oracles; no legacy implementation oracle."""
from decimal import Decimal as D, localcontext
import unittest
from market_profile_math import large_liquidity_levels

class LiquidityDecimalContextTests(unittest.TestCase):
    def contexts(self):return ((p,traps) for p in (2,7,28) for traps in (False,True))
    def evaluate(self,bids,asks,level,tick,**kwargs):
        results=[]
        for precision,traps in self.contexts():
            with self.subTest(precision=precision,traps=traps),localcontext() as ctx:
                ctx.prec=precision;ctx.Emin=-2;ctx.Emax=2
                for signal in ctx.traps:ctx.traps[signal]=traps
                ctx.clear_flags()
                results.append(large_liquidity_levels(bids,asks,level,tick,**kwargs))
                self.assertFalse(any(ctx.flags.values()))
        return results
    def test_exact_notional_survives_low_precision(self):
        for result in self.evaluate({D('1.2345'):D(10)},{},D('1.2345'),D('.001'),min_notional=D('12.1'),min_relative=D(1),max_distance_ticks=D(1)):
            self.assertEqual(result,(('bid',D('1.2345'),D('12.3450'),D(0),D(1)),))
    def test_even_median_is_exact_and_sort_does_not_round_amount(self):
        for result in self.evaluate({D(1):D('1.00001')},{D(3):D('1.00001')},D(2),D(1),min_notional=D(0),min_relative=D(0),max_distance_ticks=D(1)):
            self.assertEqual(result,(('ask',D(3),D('3.00003'),D(1),D('1.5')),('bid',D(1),D('1.00001'),D(1),D('.5'))))
    def test_relative_admission_uses_exact_fraction_not_display_ratio(self):
        # Median=3. Candidate notional=1 has exact relative 1/3.
        for threshold,admitted in [('0.33333333333333333333333333332',True),('0.33333333333333333333333333334',False)]:
            for result in self.evaluate({D(1):D(1),D(3):D(1)},{D(6):D('.5')},D(1),D(1),min_notional=D(0),min_relative=D(threshold),max_distance_ticks=D(0)):
                self.assertEqual(bool(result),admitted)
                if admitted:self.assertEqual(result[0][4],D('0.3333333333333333333333333333'))
    def test_distance_admission_uses_exact_fraction_not_display_ratio(self):
        for threshold,admitted in [('0.33333333333333333333333333332',False),('0.33333333333333333333333333334',True)]:
            for result in self.evaluate({D(1):D(1)},{},D(2),D(3),min_notional=D(0),min_relative=D(0),max_distance_ticks=D(threshold)):
                self.assertEqual(bool(result),admitted)
    def test_exact_threshold_equalities_and_empty_book(self):
        for result in self.evaluate({D(1):D(2)},{D(3):D(2)},D(2),D(1),min_notional=D(2),min_relative=D('.5'),max_distance_ticks=D(1)):
            self.assertEqual(len(result),2)
        self.assertEqual(large_liquidity_levels({}, {},D(1),D(1)),())
        self.assertEqual(large_liquidity_levels({D(1):D(0)}, {},D(1),D(1)),())
    def test_sort_uses_exact_distance_when_display_distances_tie(self):
        farther=D('11.00000000000000000000000000001')
        for result in self.evaluate({farther:D(10),D(11):D(1)},{},D(10),D(1),min_notional=D(0),min_relative=D(0),max_distance_ticks=D(2)):
            self.assertEqual([v[1] for v in result],[D(11),farther])
            self.assertEqual([v[3] for v in result],[D(1),D(1)])
    def test_extreme_exponent_even_median_stays_exact(self):
        for result in self.evaluate({D('1e-1000'):D('1e-1000')},{D('1e1000'):D('1e1000')},D('1e1000'),D('1e1000'),min_notional=D(0),min_relative=D(1),max_distance_ticks=D(2)):
            self.assertEqual(len(result),1)
            self.assertEqual(result[0][:4],('ask',D('1e1000'),D('1e2000'),D(0)))
            self.assertEqual(result[0][4],D(2))
    def test_bounded_domain_and_invalid_refusal_do_not_mutate_book(self):
        bids={D(1):D(2)};before=bids.copy()
        for bad in (True,D('NaN'),D('Infinity'),D(-1),D('1e-1001'),D('1e1001'),D('1.'+'1'*128)):
            with self.subTest(bad=bad),self.assertRaises(ValueError):large_liquidity_levels(bids,{},D(1),D(1),min_relative=bad)
            self.assertEqual(bids,before)

if __name__=='__main__':unittest.main()
