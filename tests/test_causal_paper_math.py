"""Independent literal v2 decimal kernels; no ledger, source or clock grants."""
from decimal import Decimal as D,localcontext
import unittest
from market_math import (paper_quote_metrics,paper_account_balances,paper_reservation_metrics,book_tape_research_metrics,paper_input_numeric_integrity)

class CausalPaperMathTests(unittest.TestCase):
 def test_quote_literal_fees_slippage_funding_both_sides_all_traps(self):
  for precision in (1,2,7,28):
   with localcontext() as ctx:
    ctx.prec=precision;ctx.Emin=-2;ctx.Emax=2
    for signal in ctx.traps:ctx.traps[signal]=True
    long=paper_quote_metrics('long',D(100),D(110),D('100.1'),D(10),D(10),[(D(100),D('.001'))])
    self.assertEqual(tuple(long),(D('100.1'),D('109.89'),D(1),D(1),D(10),D('9.79'),D('.21'),D('.20999'),D('.1'),D('9.48001')))
    short=paper_quote_metrics('short',D(100),D(90),D('99.9'),D(10),D(10),[(D(100),D('.001'))])
    self.assertEqual(tuple(short),(D('99.9'),D('90.09'),D(1),D(-1),D(10),D('9.81'),D('.19'),D('.18999'),D('-.1'),D('9.72001')))
    self.assertFalse(any(ctx.flags.values()))
 def test_balances_causal_settled_peak_and_pending_cash_are_distinct(self):
  self.assertEqual(tuple(paper_account_balances(D(100),[D(-10)],[D(20)],[D(3)])),(D(110),D(100),D(3),D(107)))
  self.assertEqual(tuple(paper_account_balances(D(100),[D(-10),D(20)],[],[D(3)])),(D(110),D(110),D(3),D(107)))
  with localcontext() as ctx:
   ctx.prec=2
   for signal in ctx.traps:ctx.traps[signal]=True
   self.assertEqual(paper_account_balances(D(100),[D('1e-50')],[],[]).cash,D('100.'+'0'*49+'1'))
   self.assertFalse(any(ctx.flags.values()))
 def test_reservation_exact_thresholds_do_not_use_display_ratios(self):
  def metric(spread,cash=D(200),notional=D(100),fee=D(0),reserved_limit=D(1000)):
   return paper_reservation_metrics(cash,D(100),D(0),D(3),D('3.0001'),notional,fee,reserved_limit,D('.1'),D(spread))
  low=metric('.33333333333333333333333333332');high=metric('.33333333333333333333333333334')
  self.assertTrue(low.spread_exceeded);self.assertFalse(high.spread_exceeded);self.assertEqual(low.spread_bps,high.spread_bps)
  equal=metric('1',cash=D(109),notional=D(19));self.assertFalse(equal.drawdown_exceeded)
  below=metric('1',cash=D('108.9999999999999999999999999999'),notional=D(19));self.assertTrue(below.drawdown_exceeded)
  tiny=metric('1',fee=D('1e-28'),reserved_limit=D(100));self.assertTrue(tiny.reservation_exceeded);self.assertGreater(tiny.collateral,D(100))
 def test_book_tape_literal_votes_first_seen_poc_and_anomaly(self):
  past=[(D(p),D(10)) for p in ('100','100.1','100.2','100.3')]
  result=book_tape_research_metrics(D(101),D(18),D(2),past)
  self.assertEqual((result.relative_volume,result.delta_ratio,result.base_width_fraction,result.proxy_poc,result.proxy_poc_distance),(D(2),D('.8'),D('.00299103'),D(100),D('.00990099')))
  self.assertEqual((result.long_votes,result.short_votes,result.signal),(3,0,1))
  anomaly=book_tape_research_metrics(D('100.01'),D(18),D(2),[(D(100),D(10))]*4)
  self.assertTrue(anomaly.effort_anomaly);self.assertEqual(anomaly.signal,0)
 def test_book_tape_thresholds_remain_exact_when_display_rounds_equal(self):
  past=[(D(100),D(10))]*4
  exact=book_tape_research_metrics(D('100.1'),D('7.2'),D('4.8'),past)
  below=book_tape_research_metrics(D('100.1'),D('7.1999999999999999999999999999'),D('4.8'),past)
  self.assertEqual(exact.relative_volume,below.relative_volume);self.assertTrue(exact.volume_confirmation);self.assertFalse(below.volume_confirmation)
 def test_pure_numeric_results_do_not_include_authority_or_mutate_inputs(self):
  events=[(D(100),D('.001'))];before=events.copy()
  result=paper_quote_metrics('long',D(100),D(110),D(100),D(10),D(0),events)
  self.assertEqual(events,before);self.assertFalse(hasattr(result,'execution_authority'))
  with self.assertRaises(ValueError):paper_quote_metrics('long',D(100),D(110),D(100),D(10),D(0),[(D('NaN'),D(0))])

class PaperInputNumericTests(unittest.TestCase):
 def tape(self):return dict(open=2,high=4,low=1,close=3,buy_volume=2,sell_volume=1,buy_count=2,sell_count=1,trade_count=3,delta=1,cvd=-2,range=3,aggressor_imbalance=1/3)
 def test_original_tape_book_funding_and_null_examples(self):
  self.assertTrue(paper_input_numeric_integrity('trade_tape_250ms',self.tape()))
  self.assertTrue(paper_input_numeric_integrity('orderbook_snapshot',dict(best_bid='100',best_ask='101')))
  self.assertTrue(paper_input_numeric_integrity('derivatives_ticker',dict(funding_rate=.0001,funding_interval_hour=8,next_funding_time=28800000)))
  self.assertTrue(paper_input_numeric_integrity('derivatives_ticker',{'funding_rate':None}))
  self.assertFalse(paper_input_numeric_integrity('derivatives_ticker',{}))
 def test_whole_field_domain_matrix_nonfinite_bool_and_unsigned_sign(self):
  for field in self.tape():
   for value in (True,None,float('nan'),float('inf'),float('-inf'),'NaN'):
    row=self.tape();row[field]=value
    with self.subTest(field=field,value=value):self.assertFalse(paper_input_numeric_integrity('trade_tape_250ms',row))
  for field in ('buy_volume','sell_volume','range'):
   row=self.tape();row[field]='-1e-1000';self.assertFalse(paper_input_numeric_integrity('trade_tape_250ms',row))
  row=self.tape();row['cvd']='-1e-1000';self.assertTrue(paper_input_numeric_integrity('trade_tape_250ms',row))
 def test_literal_legacy_tolerance_inside_valid_domains(self):
  row=self.tape();row['delta']=1.0000000005;self.assertTrue(paper_input_numeric_integrity('trade_tape_250ms',row))
  row['delta']=1.000000002;self.assertFalse(paper_input_numeric_integrity('trade_tape_250ms',row))
  row=self.tape();row.update(buy_volume=-0.0,sell_volume=1,delta=-1,aggressor_imbalance=-1);self.assertTrue(paper_input_numeric_integrity('trade_tape_250ms',row))
 def test_book_funding_strict_boundaries_and_count_partition(self):
  self.assertFalse(paper_input_numeric_integrity('orderbook_snapshot',dict(best_bid=1,best_ask=1)))
  self.assertFalse(paper_input_numeric_integrity('derivatives_ticker',dict(funding_rate='1.0000000000000000000001')))
  row=self.tape();row['buy_count']=True;self.assertFalse(paper_input_numeric_integrity('trade_tape_250ms',row))
  row=self.tape();row['trade_count']=4;self.assertFalse(paper_input_numeric_integrity('trade_tape_250ms',row))


class CausalBoundaryTests(unittest.TestCase):
 def test_all_decimal_kernels_ignore_hostile_context_and_leave_flags_unchanged(self):
  past=[(D(p),D(10)) for p in ('100.3','100.2','100.1','100')]
  expected=book_tape_research_metrics(D(99),D(2),D(18),past)
  self.assertEqual((expected.long_votes,expected.short_votes,expected.signal),(0,3,-1))
  for precision in (1,2,7,28):
   with localcontext() as ctx:
    ctx.prec=precision;ctx.Emin=-2;ctx.Emax=2
    for trap in ctx.traps:ctx.traps[trap]=True
    self.assertEqual(book_tape_research_metrics(D(99),D(2),D(18),past),expected)
    self.assertEqual(paper_account_balances(D(100),[D(-10)],[D(20)],[D(3)]).cash,D(110))
    result=paper_reservation_metrics(D(200),D(100),D(0),D(3),D('3.0001'),D(100),D(0),D(1000),D('.1'),D('.33333333333333333333333333332'))
    self.assertTrue(result.spread_exceeded)
    self.assertTrue(paper_input_numeric_integrity('derivatives_ticker',{'funding_rate':'-1e-1000'}))
    self.assertFalse(paper_input_numeric_integrity('derivatives_ticker',{'funding_rate':'NaN'}))
    self.assertFalse(any(ctx.flags.values()))
 def test_batch_domains_refuse_before_any_input_mutation(self):
  invalid=(True,D('NaN'),D('Infinity'),'1',D('-1e-1000'))
  for value in invalid:
   with self.subTest(value=value):
    with self.assertRaises(ValueError):paper_quote_metrics('long',value,D(100),D(100),D(0),D(0),[])
  with self.assertRaises(ValueError):paper_quote_metrics('long',D(100),D(100),D(100),D(0),D(0),[(D(100),D(0))]*129)
  with self.assertRaises(ValueError):paper_account_balances(D(100),[D(0)]*20001,[],[])
  with self.assertRaises(ValueError):paper_account_balances(D(100),[],[],[D('-1e-1000')])
  for history in ([],[(D(1),D(1))]*3,[(D(1),D(1))]*4097,[(D(1),D(0))]*4):
   with self.assertRaises(ValueError):book_tape_research_metrics(D(1),D(1),D(0),history)
 def test_numeric_domain_boundaries_and_legacy_consistency(self):
  helper=PaperInputNumericTests();base=helper.tape()
  for field in ('open','high','low','close'):
   for value in (0,-0.0,'-1e-1000','1e-1000'):
    row=base.copy();row[field]=value;self.assertFalse(paper_input_numeric_integrity('trade_tape_250ms',row))
  for field in ('buy_count','sell_count','trade_count'):
   for value in (-1,2**53,1.0,'1'):
    row=base.copy();row[field]=value;self.assertFalse(paper_input_numeric_integrity('trade_tape_250ms',row))
  self.assertFalse(paper_input_numeric_integrity('orderbook_snapshot',dict(best_bid='1e-16',best_ask=1)))
  self.assertFalse(paper_input_numeric_integrity('derivatives_ticker',dict(funding_interval_hour='-1e-1000')))
  self.assertTrue(paper_input_numeric_integrity('derivatives_ticker',dict(funding_rate=-0.0)))
  self.assertFalse(paper_input_numeric_integrity('derivatives_ticker',dict(next_funding_time='253402300800000')))


class ExactReservationOracleTests(unittest.TestCase):
 def test_fraction_oracle_for_reservation_admission(self):
  from fractions import Fraction as F
  for index in range(1,101):
   cash=D(str(100+index));peak=D(200);reserved=D(str(index));bid=D(str(index));ask=D(str(index)+'.0001');notional=D('10.12345678901234567890123456789');fee=D('.000000000000000000000001');limit=D(30);drawdown=D('.5');spread=D('1.2345678901234567890123456789')
   actual=paper_reservation_metrics(cash,peak,reserved,bid,ask,notional,fee,limit,drawdown,spread)
   collateral=F(notional)*(1+F(fee)/10000);available=F(cash)-F(reserved)
   self.assertEqual(F(actual.collateral),collateral)
   self.assertEqual(actual.spread_exceeded,(F(ask)-F(bid))*10000>F(bid)*F(spread))
   self.assertEqual(actual.reservation_exceeded,F(reserved)+collateral>F(limit))
   self.assertEqual(actual.cash_insufficient,available<collateral)
   self.assertEqual(actual.drawdown_exceeded,available-collateral<F(peak)*(1-F(drawdown)))


class ExtremeReservationDomainTests(unittest.TestCase):
 def test_drawdown_fraction_oracle_for_entire_declared_amount_domain(self):
  from fractions import Fraction as F
  for digits,exponent in ((4001,-2000),(4263,-2000),(4001,-1900)):
   peak=D((0,(1,)+(0,)*(digits-2)+(1,),exponent))
   for cash in (peak,D(1)):
    for drawdown in (D('1e-1000'),D(0),D(1)):
     for precision in (2,28):
      with localcontext() as ctx:
       ctx.prec=precision
       for signal in ctx.traps:ctx.traps[signal]=True
       actual=paper_reservation_metrics(cash,peak,D(0),D(100),D(100),D(1),D(0),peak,drawdown,D(0))
       expected=F(cash)-1<F(peak)*(1-F(drawdown))
       self.assertEqual(actual.drawdown_exceeded,expected)
       self.assertFalse(any(ctx.flags.values()))

if __name__=='__main__':unittest.main()
