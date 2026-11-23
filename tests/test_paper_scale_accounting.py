import unittest,random
from decimal import Decimal as D,Context,ROUND_HALF_EVEN,MAX_EMAX,MIN_EMIN,localcontext
from unittest.mock import patch
import market_math as m
class PaperScaleTests(unittest.TestCase):
 def api(self):
  names=('paper_scale_fractions_valid','paper_scale_entry_metrics','paper_scale_target_quantity','paper_scale_accounting','PaperScaleEvent','PaperScaleEntryMetrics','PaperScaleState')
  self.assertTrue(all(hasattr(m,n) for n in names),'scale Math API absent')
  return m.PaperScaleEvent,m.paper_scale_accounting
 def test_fraction_exact_sum_and_no_tolerance(self):
  self.api();f=m.paper_scale_fractions_valid
  self.assertIs(f((D('.5'),D('.5'))),True);self.assertIs(f((D('.3333333333333333333333333333'),)*3),False);self.assertIs(f((D(1),)),True)
 def test_fraction_closed_tuple_and_signs(self):
  self.api();f=m.paper_scale_fractions_valid
  for v in ([],[D(1)],(),(D(0),D(1)),(D('-0'),D(1)),(D(-1),D(2)),(D('NaN'),),(D('sNaN'),),(1,),('1',),(D(1),)*17):self.assertIs(f(v),False)
 def test_fraction_resource_budget_and_future_leaf_preflight(self):
  self.api();calls=[]
  with patch.object(m,'exact_sum',side_effect=lambda *a:calls.append(a)):
   self.assertIs(m.paper_scale_fractions_valid((D('.5'),object())),False)
  self.assertEqual(calls,[]);self.assertIs(m.paper_scale_fractions_valid((D('1e-2001'),D(1))),False)
 def test_entry_metrics_adverse_long_short_and_private_sizing(self):
  self.api();a=m.paper_scale_entry_metrics('long',D(100),D(100),D('.5'),D(100));b=m.paper_scale_entry_metrics('short',D(100),D(100),D('.5'),D(100))
  self.assertIs(type(a),m.PaperScaleEntryMetrics);self.assertEqual(a.price,D(101));self.assertEqual(b.price,D(99));self.assertEqual(a.quantity,m.paper_position_size(D(50),D(101)));self.assertEqual(b.quantity,m.paper_position_size(D(50),D(99)))
 def test_entry_no_binary64_scale_or_coercion(self):
  self.api()
  with patch.object(m,'paper_scale_value',side_effect=AssertionError('binary64 path')):
   a=m.paper_scale_entry_metrics('long',D(100),D(100),D(1),D(0))
  self.assertEqual(tuple(a),(D(100),D(1)))
 def test_entry_whole_preflight_before_context_or_adverse(self):
  self.api();calls=[]
  with patch.object(m,'_paper_context',side_effect=lambda:calls.append('context')),patch.object(m,'adverse_execution_price',side_effect=lambda *a:calls.append('adverse')):
   for args in (('long',D(1),D(1),D('.5'),object()),('long',D(1),D(1),D(0),D(0)),('long',D(1),D(1),D(1),D(10000))):
    with self.assertRaises(ValueError):m.paper_scale_entry_metrics(*args)
  self.assertEqual(calls,[])
 def test_target_fraction_one_preserves_entire_exact_remainder(self):
  self.api();tiny=D('1e-1000');self.assertEqual(m.paper_scale_target_quantity(tiny,D(1),D(1)),tiny)
  self.assertEqual(m.paper_scale_target_quantity(D('1.0000000000000000000000000000001'),D(2),D(1)),D('1.0000000000000000000000000000001'))
 def test_target_nominal_fraction_of_opened_is_capped(self):
  self.api();f=m.paper_scale_target_quantity;self.assertEqual(f(D(2),D(4),D('.25')),D(1));self.assertEqual(f(D('.5'),D(4),D('.25')),D('.5'))
  for args in ((D(0),D(1),D(1)),(D(2),D(1),D('.5')),(D(1),D(1),D(0))):
   with self.assertRaises(ValueError):f(*args)
 def test_target_partial_rounding_collapse_refuses(self):
  self.api();fraction=D('0.'+'9'*128)
  with self.assertRaises(ValueError):m.paper_scale_target_quantity(D(1),D(1),fraction)
 def test_empty_accounting_has_no_fabricated_means(self):
  R,f=self.api();a=f('long',(),D(0));self.assertIs(type(a),m.PaperScaleState);self.assertEqual((a.remaining_quantity,a.remaining_cost,a.opened_quantity,a.exited_quantity,a.gross_pnl,a.fees,a.net_pnl),(D(0),)*7);self.assertEqual((a.current_entry_price,a.entry_mean,a.exit_mean),(None,None,None));self.assertIs(a.closed,False)
 def test_long_and_short_closed_hand_oracles_actual_fees(self):
  R,f=self.api()
  for side,exit,gross in (('long',110,20),('short',90,20)):
   a=f(side,(R('ENTRY',D(100),D(2)),R('EXIT',D(exit),D(2))),D('.01'));fees=D('4.2') if side=='long' else D('3.8')
   self.assertEqual((a.gross_pnl,a.fees,a.net_pnl),(D(gross),fees,D(gross)-fees));self.assertEqual((a.remaining_quantity,a.remaining_cost),(D(0),D(0)));self.assertTrue(a.closed)
 def test_partial_pool_current_mean_and_realized_gross(self):
  R,f=self.api();a=f('long',(R('ENTRY',D(100),D(2)),R('EXIT',D(110),D('.5'))),D(0));self.assertEqual((a.remaining_quantity,a.remaining_cost,a.current_entry_price,a.gross_pnl),(D('1.5'),D(150),D(100),D(5)))
 def test_late_entry_after_exit_never_rebases_prior_realization(self):
  R,f=self.api();prefix=(R('ENTRY',D(100),D(1)),R('EXIT',D(110),D('.5')));a=f('long',prefix,D(0));b=f('long',prefix+(R('ENTRY',D(200),D(1)),),D(0));c=f('long',prefix+(R('ENTRY',D(200),D(1)),R('EXIT',D(210),D('1.5'))),D(0));self.assertEqual(a.gross_pnl,D(5));self.assertEqual(b.gross_pnl,D(5));self.assertEqual((b.remaining_cost,b.remaining_quantity),(D(250),D('1.5')));self.assertEqual(c.gross_pnl,D(70));self.assertEqual(b.entry_mean,D(150))
 def test_near_full_exit_retains_analytical_tiny_cost(self):
  R,f=self.api();tiny=D('1e-40');q=D('0.'+'9'*40);a=f('long',(R('ENTRY',D(1),D(1)),R('EXIT',D(1),q)),D(0));self.assertEqual(a.remaining_quantity,tiny);self.assertEqual(a.remaining_cost,tiny);self.assertGreater(a.current_entry_price,D(0));self.assertFalse(a.closed)
 def test_tiny_exit_releases_positive_small_cost(self):
  R,f=self.api();a=f('long',(R('ENTRY',D(1),D(1)),R('EXIT',D(2),D('1e-40'))),D(0));self.assertEqual(a.gross_pnl,D('1e-40'));self.assertEqual(a.remaining_cost,D('0.'+'9'*40));self.assertEqual(a.remaining_quantity,D('0.'+'9'*40))
 def test_tiny_quantity_conservation_and_full_close_no_epsilon(self):
  R,f=self.api();tiny=D('1e-1000');start=(R('ENTRY',D(1),D(1)),R('ENTRY',D(1),tiny),R('EXIT',D(2),D(1)));a=f('long',start,D(0));self.assertEqual((a.remaining_quantity,a.remaining_cost),(tiny,tiny));b=f('long',start+(R('EXIT',D(2),tiny),),D(0));self.assertEqual((b.remaining_quantity,b.remaining_cost),(D(0),D(0)));self.assertEqual(b.opened_quantity,b.exited_quantity);self.assertEqual(b.net_pnl,m.exact_sum((D(1),tiny)));self.assertTrue(b.closed)
 def test_fee_basis_is_actual_rounded_execution_not_planned_allocation(self):
  R,f=self.api();entry=m.paper_scale_entry_metrics('long',D(3),D(1),D(1),D(0));a=f('long',(R('ENTRY',entry.price,entry.quantity),),D('.01'));ctx=Context(prec=28,rounding=ROUND_HALF_EVEN,Emin=MIN_EMIN,Emax=MAX_EMAX,traps=[]);value=ctx.multiply(entry.price,entry.quantity);self.assertEqual(a.entry_value_total,value);self.assertEqual(a.entry_fees,m.paper_entry_fee(value,D('.01')));self.assertEqual(a.net_pnl,a.entry_fees.copy_negate())
 def test_exit_before_entry_over_exit_and_terminal_reentry_refuse(self):
  R,f=self.api()
  for rows in ((R('EXIT',D(1),D(1)),),(R('ENTRY',D(1),D(1)),R('EXIT',D(2),D(2))),(R('ENTRY',D(1),D(1)),R('EXIT',D(2),D(1)),R('ENTRY',D(1),D(1)))):
   with self.assertRaises(ValueError):f('long',rows,D(0))
 def test_closed_literal_graph_has_zero_foreign_callbacks(self):
  R,f=self.api();calls=[]
  class Meta(type):
   def __eq__(self,v):calls.append('meta');raise AssertionError
  class Foreign(metaclass=Meta):
   def __float__(self):calls.append('float');raise AssertionError
   def __iter__(self):calls.append('iter');raise AssertionError
  class Decimal(D):
   def is_finite(self):calls.append('finite');raise AssertionError
  class Event(R):pass
  class List(list):
   def __iter__(self):calls.append('iter');raise AssertionError
  class Tag(str):
   def __eq__(self,v):calls.append('eq');raise AssertionError
  for rows in (Foreign(),List(),(Event('ENTRY',D(1),D(1)),),(R(Tag('ENTRY'),D(1),D(1)),),(R('ENTRY',Decimal(1),D(1)),),(R('ENTRY',D(1),Foreign()),),(R('ENTRY',True,D(1)),),(R('ENTRY',D('sNaN'),D(1)),)):
   with self.assertRaises(ValueError):f('long',rows,D(0))
  self.assertEqual(calls,[])
 def test_all_event_leaves_preflight_before_first_financial_helper(self):
  R,f=self.api();calls=[]
  with patch.object(m,'_paper_context',side_effect=lambda:calls.append('context')),patch.object(m,'paper_entry_fee',side_effect=lambda *a:calls.append('fee')):
   with self.assertRaises(ValueError):f('long',(R('ENTRY',D(1),D(1)),R('EXIT',object(),D(1))),D(0))
  self.assertEqual(calls,[])
 def test_snapshot_survives_first_context_mutation_of_original_list(self):
  R,f=self.api();rows=[R('ENTRY',D(100),D(1)),R('EXIT',D(110),D(1))];orig=m._paper_context
  def context():rows.clear();return orig()
  with patch.object(m,'_paper_context',side_effect=context):a=f('long',rows,D(0))
  self.assertEqual(a.net_pnl,D(10));self.assertEqual(rows,[])
 def test_event_count_and_derived_exact_amount_budget(self):
  R,f=self.api();rows=(R('ENTRY',D(1),D(1)),)*32+(R('EXIT',D(2),D(1)),)*32;a=f('long',rows,D(0));self.assertEqual(a.net_pnl,D(32))
  for values in (rows+(R('EXIT',D(1),D(1)),),(R('ENTRY',D(1),D('1e-2001')),),(R('ENTRY',D('1e2000'),D('1e2000')),)):
   with self.assertRaises(ValueError):f('long',values,D(0))
 def test_caller_decimal_context_and_rng_unchanged(self):
  R,f=self.api();state=random.getstate()
  for precision in (1,3,28):
   with localcontext() as ctx:
    ctx.prec=precision;ctx.Emax=2;ctx.Emin=-2
    for signal in ctx.traps:ctx.traps[signal]=True
    before=ctx.copy();a=f('long',(R('ENTRY',D(100),D(1)),R('EXIT',D(110),D(1))),D('.01'));self.assertEqual(a.net_pnl,D('7.9'));self.assertTrue(m.paper_scale_fractions_valid((D('.5'),D('.5'))));self.assertEqual(ctx.flags,before.flags);self.assertEqual(ctx.traps,before.traps);self.assertEqual((ctx.prec,ctx.Emax,ctx.Emin),(before.prec,before.Emax,before.Emin))
  self.assertEqual(random.getstate(),state)
 def test_typed_result_immutable_and_means_are_descriptive(self):
  R,f=self.api();a=f('long',(R('ENTRY',D(100),D(1)),R('EXIT',D(110),D('.5')),R('ENTRY',D(200),D(1))),D(0));self.assertEqual(a.entry_mean,D(150));self.assertEqual(a.exit_mean,D(110));self.assertNotEqual(a.current_entry_price,a.entry_mean)
  with self.assertRaises(AttributeError):a.remaining_cost=D(0)
