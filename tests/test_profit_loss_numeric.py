import unittest
from decimal import Decimal,localcontext
class ProfitLossNumericTests(unittest.TestCase):
 def summary(self,values):
  from history_statistics import numeric_profit_loss_summary
  return numeric_profit_loss_summary(values)
 def project(self,values):
  from history_statistics import project_decimal_observations
  return project_decimal_observations(values)
 def test_mixed_outcomes_totals_factor_and_drawdown(self):
  out=self.summary((2,-1,3,-4,0,-1))
  self.assertEqual((out.numeric.count,out.numeric.positive,out.numeric.negative),(6,2,3));self.assertEqual(out.numeric.total,-1)
  self.assertEqual((out.gross_profit,out.gross_loss,out.profit_factor.kind,out.profit_factor.value),(5,6,'FINITE',5/6))
  self.assertEqual((out.max_drawdown,out.max_consecutive_losses),(5,1))
 def test_no_losses_and_zero_are_distinct_factor_tags(self):
  out=self.summary((1,2,0));self.assertEqual((out.profit_factor.kind,out.profit_factor.value),('NO_LOSSES',None))
  out=self.summary((0,0));self.assertEqual((out.profit_factor.kind,out.profit_factor.value),('FINITE',0))
 def test_empty_summary_never_invents_samples(self):
  out=self.summary(());self.assertEqual((out.numeric.count,out.numeric.mean,out.max_drawdown,out.max_consecutive_losses),(0,0,0,0))
 def test_ordered_binary64_and_streak_reset(self):
  out=self.summary((1e16,1,-1e16,-1,-2,0,-1))
  self.assertEqual(out.numeric.total,-4);self.assertEqual(out.max_consecutive_losses,3)
 def test_summary_refuses_nonfinite_derived_results(self):
  for values in ((1e308,1e308),(1e308,-1e308,-1e308),(1e308,-5e-324)):
   with self.assertRaises(ValueError):self.summary(values)
 def test_decimal_projection_is_explicit_rounding_not_exact_accounting(self):
  out=self.project((Decimal('0.1'),Decimal('-2.25'),Decimal('-0')))
  self.assertEqual(out,(.1,-2.25,-0.));self.assertIs(type(out[0]),float)
 def test_decimal_projection_refuses_nonfinite_overflow_underflow(self):
  for value in (Decimal('NaN'),Decimal('sNaN'),Decimal('Infinity'),Decimal('1e9999'),Decimal('1e-9999')):
   with self.assertRaises(ValueError):self.project((value,))
 def test_decimal_projection_preserves_hostile_context(self):
  for precision in (2,3,28):
   with localcontext() as context:
    context.prec=precision;context.Emax=2;context.Emin=-2
    for signal in context.traps:context.traps[signal]=True
    context.clear_flags();before=dict(context.flags)
    self.assertEqual(self.project((Decimal('12345.6789'),Decimal('-0.00012345'))),(12345.6789,-.00012345))
    self.assertEqual(dict(context.flags),before)
 def test_closed_literal_inputs_do_not_invoke_foreign_callbacks(self):
  class Meta(type):
   def __eq__(cls,other):raise AssertionError('foreign eq')
  class Foreign(metaclass=Meta):
   def __float__(self):raise AssertionError('foreign float')
  class FakeDecimal(Decimal):
   def __float__(self):raise AssertionError('decimal subclass float')
  for value in (Foreign(),True,Decimal(1),float('inf')):
   with self.assertRaises(ValueError):self.summary((value,))
  for value in (Foreign(),True,1,1.,FakeDecimal('1')):
   with self.assertRaises(ValueError):self.project((value,))
  for fn in (self.summary,self.project):
   with self.assertRaises(ValueError):fn(Foreign())
 def test_budgets_and_input_containers_remain_unchanged(self):
  values=[Decimal('1'),Decimal('-2')];before=list(values)
  self.assertEqual(self.project(values),(1.,-2.));self.assertEqual(values,before)
  self.assertEqual(self.summary((0,)*4096).numeric.count,4096)
  with self.assertRaises(ValueError):self.summary((0,)*4097)
  with self.assertRaises(ValueError):self.project((Decimal(0),)*4097)

class DeclaredTradeNumericTests(unittest.TestCase):
 def api(self):
  import history_statistics as h
  self.assertTrue(hasattr(h,'numeric_trade_summary'),'declared trade API absent')
  return h,h.NumericTradeObservation,h.numeric_trade_summary
 def test_declared_trade_hand_oracle(self):
  h,R,s=self.api();out=s([R(5,4,1,-1,2,1,60000),R(-2,-2.5,.5,None,4,-.5,120000),R(0,0,0,-3)])
  self.assertEqual((out.gross_pnl_total,out.fees_total),(3,1.5))
  self.assertEqual(out.net,h.numeric_profit_loss_summary((4,-2.5,0)))
  self.assertEqual((out.net.numeric.total,out.net.numeric.mean,out.net.profit_factor.value,out.net.max_drawdown,out.net.max_consecutive_losses),(1.5,.5,1.6,2.5,1))
  self.assertEqual(tuple(out.mae),(2,-4,-2));self.assertEqual(tuple(out.mfe),(2,6,3))
  self.assertEqual(tuple(out.r_multiple),(2,.5,.25));self.assertEqual(tuple(out.holding_ms),(2,180000,90000))
  with self.subTest(original_id='tests/research/test_statistics_reporting.py::test_statistics_compute_core_metrics_drawdown_and_streaks'):
   legacy=s((R(2.2,2,.2,-.5,3,1,60),R(-.8,-1,.2,-2,.2,-.5,120),R(-1.8,-2,.2,-3,.1,-1,60)))
   self.assertEqual((legacy.net.numeric.count,legacy.net.numeric.positive,legacy.net.numeric.negative),(3,1,2))
   self.assertEqual(round(legacy.net.numeric.positive_fraction,6),round(1/3,6))
   self.assertEqual(legacy.net.numeric.total,-1);self.assertEqual(round(legacy.fees_total,10),.6)
   self.assertEqual(legacy.net.numeric.mean,-1/3);self.assertEqual(legacy.net.profit_factor.value,2/3)
   self.assertEqual(legacy.net.max_drawdown,3);self.assertEqual(legacy.net.max_consecutive_losses,2)
   self.assertEqual(legacy.holding_ms.mean,80);self.assertLess(legacy.mae.mean,0);self.assertGreater(legacy.mfe.mean,0)
 def test_empty_missing_and_explicit_zero_are_distinct(self):
  h,R,s=self.api()
  for out in (s(()),s((R(0,0,0),))):
   for value in (out.mae,out.mfe,out.r_multiple,out.holding_ms):self.assertEqual(tuple(value),(0,0,None))
  out=s((R(0,0,0,0,0,0,0),))
  for value in (out.mae,out.mfe,out.r_multiple,out.holding_ms):self.assertEqual(tuple(value),(1,0,0))
  with self.assertRaises(AttributeError):out.fees_total=2
 def test_signed_declarations_no_identity_or_precision_inference(self):
  h,R,s=self.api();out=s((R(.3,.2,.1,2,-3,-4),))
  self.assertEqual((out.mae.mean,out.mfe.mean,out.r_multiple.mean),(2,-3,-4))
  self.assertEqual(s((R(0,99,0),)).net.numeric.total,99)
 def test_invalid_literal_fields_and_holding_bounds(self):
  h,R,s=self.api()
  for field in range(7):
   bad=(True,Decimal('1'),float('nan'),float('inf'),2**53+1)
   if field==6:bad+=(1.,-1,2**53)
   for value in bad:
    args=[1,1,0,None,None,None,None];args[field]=value
    with self.assertRaises(ValueError):s((R(*args),))
  with self.assertRaises(ValueError):s((R(1,1,-.1),))
  self.assertEqual(s((R(1,1,0,holding_ms=2**53-1),)).holding_ms.total,float(2**53-1))
 def test_all_inputs_preflight_before_any_summary_helper(self):
  from unittest.mock import patch
  h,R,s=self.api();calls=[]
  for kwargs in ({'fees':-1},{'mae':object()},{'holding_ms':1.}):
   row=R(1,1,0)._replace(**kwargs)
   with patch.object(h,'numeric_sample_summary',side_effect=lambda *a:calls.append(a)),patch.object(h,'numeric_profit_loss_summary',side_effect=lambda *a:calls.append(a)):
    with self.assertRaises(ValueError):s((R(1,1,0),row))
   self.assertEqual(calls,[])
 def test_snapshot_before_first_numeric_admission(self):
  from unittest.mock import patch
  h,R,s=self.api();rows=[R(5,4,1,-1),R(-2,-2.5,.5,-3)];original=h._screen_number;calls=[]
  def admit(value):
   calls.append(value);rows.clear();return original(value)
  with patch.object(h,'_screen_number',side_effect=admit):out=s(rows)
  self.assertEqual(out.gross_pnl_total,3);self.assertEqual(out.net.numeric.total,1.5);self.assertEqual(out.mae.count,2);self.assertTrue(calls)
 def test_closed_record_container_and_foreign_callbacks(self):
  h,R,s=self.api();calls=[]
  class Foreign:
   def __float__(self):calls.append('float');raise AssertionError
   def __eq__(self,other):calls.append('eq');raise AssertionError
   def __iter__(self):calls.append('iter');raise AssertionError
  class ForeignFloat(float):
   def __float__(self):calls.append('float');raise AssertionError
  class ForeignList(list):
   def __iter__(self):calls.append('iter');raise AssertionError
  class ForeignRecord(R):pass
  class Meta(type):
   def __instancecheck__(self,value):calls.append('instance');raise AssertionError
   def __eq__(self,value):calls.append('meta_eq');raise AssertionError
  class Fake(metaclass=Meta):pass
  for rows in (Foreign(),ForeignList(),iter(()),(tuple(R(1,1,0)),),(ForeignRecord(1,1,0),),(Fake(),),(R(Foreign(),1,0),),(R(ForeignFloat(1),1,0),)):
   with self.assertRaises(ValueError):s(rows)
  self.assertEqual(calls,[])
 def test_bounded_batch_and_inputs_unchanged(self):
  h,R,s=self.api();rows=[R(1,1,0)]*4096;before=tuple(rows)
  self.assertEqual(s(rows).net.numeric.count,4096);self.assertEqual(tuple(rows),before)
  with self.assertRaises(ValueError):s(rows+[R(1,1,0)])
  self.assertEqual(s(tuple(rows)),s(rows))
 def test_ordered_totals_and_partial_optional_availability(self):
  h,R,s=self.api();rows=(R(1e16,0,0,1e16),R(1,0,0,1),R(-1e16,0,0,-1e16),R(2,0,0,None))
  out=s(rows);self.assertEqual(out.gross_pnl_total,2);self.assertEqual(tuple(out.mae),(3,0,0));self.assertEqual(out.mfe.mean,None)
 def test_derived_overflow_refuses_atomically(self):
  h,R,s=self.api()
  for field in (0,1,2,3,4,5):
   args=[0,0,0,None,None,None,None];args[field]=1e308;rows=(R(*args),R(*args))
   with self.assertRaises(ValueError):s(rows)
  with self.assertRaises(ValueError):s((R(0,1e308,0),R(0,-5e-324,0)))
 def test_binary64_subnormal_rounding_is_declared(self):
  h,R,s=self.api();out=s((R(5e-324,5e-324,0,5e-324),R(0,0,0,0)))
  self.assertEqual(out.gross_pnl_total,5e-324);self.assertEqual(out.mae.total,5e-324);self.assertEqual(out.mae.mean,0)
 def test_decimal_context_preserved_and_projection_explicit(self):
  h,R,s=self.api()
  for precision in (2,28):
   with localcontext() as context:
    context.prec=precision;context.Emax=2;context.Emin=-2
    for signal in context.traps:context.traps[signal]=True
    context.clear_flags();before=context.copy()
    out=s((R(*h.project_decimal_observations((Decimal('5'),Decimal('4'),Decimal('1')))),))
    self.assertEqual(out.net.numeric.total,4);self.assertEqual(context.flags,before.flags);self.assertEqual(context.traps,before.traps)
