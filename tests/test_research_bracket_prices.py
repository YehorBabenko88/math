"""Pure simulation geometry; no orders, clocks, source trust or process execution."""
import math
import unittest
from decimal import Decimal,localcontext
import market_math as kernels

class ResearchBracketPricesTests(unittest.TestCase):
 def api(self):
  self.assertTrue(hasattr(kernels,'research_bracket_prices'),'Math research bracket API missing')
  return kernels.research_bracket_prices
 def test_original_default_long_geometry(self):
  x=self.api()(100,.01,'long');self.assertEqual(tuple(x),(99.25,101.125))
 def test_original_default_short_geometry(self):
  x=self.api()(100,.01,'short');self.assertEqual(tuple(x),(100.75,98.875))
 def test_zero_atr_retains_original_minimum_fraction_floor(self):
  self.assertEqual(tuple(self.api()(100,0,'long')),(99.95,100.075))
 def test_original_custom_reward_and_stop_multipliers(self):
  self.assertEqual(tuple(self.api()(100,.01,'long',reward_risk=2,stop_atr=1)),(99.,102.))
 def test_zero_multipliers_preserve_floor_and_zero_reward(self):
  self.assertEqual(tuple(self.api()(100,.01,'long',reward_risk=0,stop_atr=0)),(99.95,100.))
 def test_signed_algebraic_thresholds_are_not_executable_price_admission(self):
  self.assertEqual(tuple(self.api()(100,2,'long')),(-50.,325.))
  self.assertEqual(tuple(self.api()(100,2,'short')),(250.,-125.))
 def test_nonliteral_numbers_never_coerce_or_call_foreign_methods(self):
  class I(int):pass
  class F(float):pass
  class Hostile(type):
   def __eq__(self,other):raise AssertionError('FOREIGN_TYPE_EQUALITY')
  class Foreign(metaclass=Hostile):
   def __float__(self):raise AssertionError('FOREIGN_COERCION')
  for value in (None,True,I(100),F(100),Decimal('100'),'100',Foreign()):
   with self.subTest(kind=type(value).__name__),self.assertRaises(ValueError):self.api()(value,.01,'long')
 def test_side_is_exact_closed_literal_without_callbacks(self):
  class Side(str):
   def __eq__(self,other):raise AssertionError('FOREIGN_SIDE_EQUALITY')
  for side in (None,True,'LONG','buy','long ','','x'*4096,Side('long')):
   with self.assertRaises(ValueError):self.api()(100,.01,side)
 def test_nonfinite_and_invalid_entry_or_atr_refused(self):
  for value in (float('nan'),float('inf'),float('-inf'),-1.,0):
   with self.assertRaises(ValueError):self.api()(value,.01,'long')
  for value in (float('nan'),float('inf'),-1.):
   with self.assertRaises(ValueError):self.api()(100,value,'long')
 def test_negative_nonfinite_or_nonliteral_policy_refused(self):
  for value in (-1.,float('nan'),float('inf'),True,'1'):
   for field in ('reward_risk','stop_atr'):
    with self.assertRaises(ValueError):self.api()(100,.01,'long',**{field:value})
 def test_lossy_and_overlarge_integers_refused_without_rounding(self):
  for value in (2**53+1,2**1024,1<<1000000):
   with self.assertRaises(ValueError):self.api()(value,.01,'long')
  result=self.api()(2**54,.01,'long');self.assertTrue(all(math.isfinite(x) for x in result))
 def test_derived_overflow_refuses_whole_result(self):
  with self.assertRaises(ValueError):self.api()(1e308,1e308,'long',reward_risk=1e308)
 def test_caller_decimal_context_flags_and_traps_unchanged(self):
  with localcontext() as context:
   context.prec=2;context.Emax=2;context.Emin=-2
   for signal in context.traps:context.traps[signal]=True
   for signal in context.flags:context.flags[signal]=True
   before=(dict(context.flags),dict(context.traps),context.prec,context.Emax,context.Emin)
   self.assertEqual(tuple(self.api()(100,.01,'long')),(99.25,101.125))
   self.assertEqual((dict(context.flags),dict(context.traps),context.prec,context.Emax,context.Emin),before)
 def test_result_is_immutable_numeric_tuple_only(self):
  result=self.api()(100,.01,'long')
  self.assertEqual(result._fields,('stop_loss','take_profit'))
  with self.assertRaises(AttributeError):result.stop_loss=0
  self.assertTrue(all(type(x) is float for x in result))
