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
