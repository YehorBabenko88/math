import unittest
from decimal import Decimal,localcontext
import market_math as kernels
class EntryNumericPolicyTests(unittest.TestCase):
 def signed(self):
  self.assertTrue(hasattr(kernels,'lossless_binary64_valid'));return kernels.lossless_binary64_valid
 def match(self):
  self.assertTrue(hasattr(kernels,'research_retest_matches'));return kernels.research_retest_matches
 def test_signed_finite_literal_domain_including_negative_zero(self):
  for value in (-12,-.25,-0.,0,12,.25):self.assertIs(self.signed()(value),True)
 def test_exact_large_signed_integers_preserved(self):
  for value in (2**54,-2**54,2**1023,-2**1023):self.assertIs(self.signed()(value),True)
 def test_lossy_huge_and_nonfinite_signed_values_refuse(self):
  for value in (2**53+1,-(2**53+1),2**1024,-(2**1024),float('nan'),float('inf'),float('-inf')):self.assertIs(self.signed()(value),False)
 def test_signed_validator_never_invokes_foreign_callbacks(self):
  class F(float):
   def __abs__(self):raise AssertionError('FOREIGN_ABS')
   def __lt__(self,x):raise AssertionError('FOREIGN_COMPARE')
  class Meta(type):
   def __eq__(self,x):raise AssertionError('FOREIGN_TYPE_EQUALITY')
  class Foreign(metaclass=Meta):
   def __float__(self):raise AssertionError('FOREIGN_FLOAT')
  for value in (True,F(-1),Decimal('-1'),'-1',None,Foreign()):self.assertIs(self.signed()(value),False)
 def test_nonnegative_policy_remains_strict_and_distinct(self):
  self.assertIs(kernels.lossless_nonnegative_binary64_valid(-1),False);self.assertIs(self.signed()(-1),True)
 def test_original_long_retest_and_inclusive_touch(self):self.assertIs(self.match()(103,101,102,100,'long',tolerance=.01),True)
 def test_original_short_retest_and_inclusive_touch(self):self.assertIs(self.match()(99,97,98,100,'short',tolerance=.01),True)
 def test_close_must_cross_level_strictly(self):
  for side in ('long','short'):self.assertIs(self.match()(101,99,100,100,side,tolerance=.01),False)
 def test_untouched_side_refuses_match(self):
  self.assertIs(self.match()(104,102,103,100,'long',tolerance=.01),False)
  self.assertIs(self.match()(98,96,97,100,'short',tolerance=.01),False)
 def test_zero_tolerance_keeps_original_boundary(self):
  self.assertIs(self.match()(102,100,101,100,'long',tolerance=0),True)
  self.assertIs(self.match()(100,98,99,100,'short',tolerance=0),True)
 def test_original_default_tolerance_numeric_geometry(self):
  self.assertIs(self.match()(101,100.14,100.2,100,'long'),True)
  self.assertIs(self.match()(99.86,99,99.8,100,'short'),True)
 def test_side_is_closed_literal_before_callbacks(self):
  class S(str):
   def __eq__(self,x):raise AssertionError('FOREIGN_SIDE_EQUALITY')
  for side in (S('long'),True,'LONG','buy',None):
   with self.assertRaises(ValueError):self.match()(103,101,102,100,side)
 def test_price_and_policy_domain_preflight(self):
  for value in (True,Decimal('1'),'1',float('nan'),float('inf'),-1,2**53+1):
   for index in range(5):
    args=[103,101,102,100,.01];args[index]=value
    with self.assertRaises(ValueError):self.match()(*args[:4],'long',tolerance=args[4])
 def test_ordered_positive_price_contract(self):
  for args in ((100,101,100,100),(100,99,101,100),(100,99,99,0),(1,0,0,1)):
   with self.assertRaises(ValueError):self.match()(*args,'long')
 def test_nonrepresentable_derived_boundary_refuses(self):
  with self.assertRaises(ValueError):self.match()(1.7e308,1e308,1.2e308,1e308,'long',tolerance=1e308)
 def test_algebraic_negative_short_boundary_is_not_price_admission(self):self.assertIs(self.match()(2,1,1.5,100,'short',tolerance=2),True)
 def test_caller_decimal_context_unchanged(self):
  with localcontext() as c:
   c.prec=2
   for flag in c.flags:c.flags[flag]=True;c.traps[flag]=True
   before=(dict(c.flags),dict(c.traps));self.assertIs(self.signed()(-.25),True);self.assertIs(self.match()(103,101,102,100,'long',tolerance=.01),True);self.assertEqual((dict(c.flags),dict(c.traps)),before)
