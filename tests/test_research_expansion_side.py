"""Numerical candle-body policy transferred from research entry generation."""
import unittest
from decimal import Decimal,localcontext
import market_math as kernels
class ResearchExpansionSideTests(unittest.TestCase):
 def api(self):
  self.assertTrue(hasattr(kernels,'research_expansion_side'))
  return kernels.research_expansion_side
 def test_rising_body_matches_original_policy(self):self.assertEqual(self.api()(100,101,.01),'long')
 def test_falling_body_matches_original_policy(self):self.assertEqual(self.api()(101,100,.01),'short')
 def test_small_body_refuses_signal(self):self.assertIsNone(self.api()(100,100.1,.01))
 def test_exact_threshold_is_inclusive(self):self.assertEqual(self.api()(99,100,.02),'long')
 def test_zero_atr_zero_body_retains_original_short_choice(self):self.assertEqual(self.api()(100,100,0),'short')
 def test_zero_multiplier_retains_original_zero_threshold(self):self.assertEqual(self.api()(100,100,.1,min_body_atr=0),'short')
 def test_invalid_literals_refuse_before_callbacks(self):
  class F(float):
   def __float__(self):raise AssertionError('FOREIGN_FLOAT')
  for value in (True,Decimal('1'),'1',F(1),None):
   for index in range(4):
    args=[100,101,.01,.5];args[index]=value
    with self.assertRaises(ValueError):self.api()(*args[:3],min_body_atr=args[3])
 def test_domain_nonfinite_lossy_and_overflow_refuse(self):
  for value in (-1,float('inf'),float('nan'),2**53+1,2**1024):
   with self.assertRaises(ValueError):self.api()(100,101,value)
  with self.assertRaises(ValueError):self.api()(0,101,.01)
  with self.assertRaises(ValueError):self.api()(100,0,.01)
  with self.assertRaises(ValueError):self.api()(100,1e308,1e308)
 def test_decimal_context_untouched(self):
  with localcontext() as c:
   c.prec=2
   for signal in c.flags:c.flags[signal]=True;c.traps[signal]=True
   before=(dict(c.flags),dict(c.traps))
   self.assertEqual(self.api()(100,101,.01),'long')
   self.assertEqual((dict(c.flags),dict(c.traps)),before)
