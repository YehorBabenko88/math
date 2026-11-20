"""Exact scaled integers are not epoch floor conversions."""
from decimal import Decimal as D,localcontext,Inexact,Rounded
from fractions import Fraction
import unittest,market_math
class ExactScaledIntegerTests(unittest.TestCase):
 def convert(self,value,scale):
  self.assertTrue(hasattr(market_math,'exact_scaled_integer'),'missing public exact scaled integer')
  return market_math.exact_scaled_integer(value,scale)
 def test_hand_oracles_clock_units_integrality_and_safe_integer_boundary(self):
  for value,scale,expected in [('.125',3600000,450000),('1.5',2,3),('0',1,0),('-0',86400000,0),('9007199254740991',1,9007199254740991),('0.000001',1000000,1),('1',86400000,86400000)]:
   result=self.convert(D(value),scale);self.assertIs(type(result),int);self.assertEqual(result,expected)
  for value,scale in [('1.5',1),('0.0000001',3600000),('1e-1000',1),('-1e-1000',1),('9007199254740992',1),('9007199254740991',2)]:
   with self.assertRaises(ValueError):self.convert(D(value),scale)
 def test_strict_value_and_scale_types_no_untrusted_callbacks(self):
  class Hostile:
   def __int__(self):raise AssertionError('UNTRUSTED_CONVERSION')
   def __le__(self,other):raise AssertionError('UNTRUSTED_COMPARISON')
  class DecimalSubclass(D):pass
  class IntSubclass(int):pass
  for bad in (True,False,None,0,1.0,'1',D('NaN'),D('sNaN'),D('Infinity'),D('-Infinity'),D('1e1001'),D('0e-1001'),D('1.'+'0'*128),DecimalSubclass('1'),Hostile()):
   with self.assertRaises(ValueError):self.convert(bad,1)
  for bad in (True,False,None,0,-1,86400001,1.0,D(1),'1',IntSubclass(1),Hostile()):
   with self.assertRaises(ValueError):self.convert(D(1),bad)
 def test_context_traps_and_preexisting_flags_unchanged_on_success_and_refusal(self):
  for precision in (1,2,3,5,28):
   with localcontext() as c:
    c.prec=precision;c.Emin=-2;c.Emax=2
    for signal in c.traps:c.traps[signal]=True
    c.flags[Inexact]=True;c.flags[Rounded]=True;before=dict(c.flags)
    self.assertEqual(self.convert(D('.125'),3600000),450000)
    for value in (D('1e-1000'),D('sNaN'),D('-1e-1000'),D('9007199254740992')):
     with self.assertRaises(ValueError):self.convert(value,1)
    self.assertEqual(dict(c.flags),before)
 def test_fraction_oracle_exact_no_floor(self):
  for coefficient in range(41):
   for exponent in (-6,-3,0,2):
    value=D((0,tuple(map(int,str(coefficient))),exponent))
    for scale in (1,2,1000,3600000,86400000):
     oracle=Fraction(value)*scale
     if oracle.denominator==1 and 0<=oracle.numerator<=2**53-1:self.assertEqual(self.convert(value,scale),oracle.numerator)
     else:
      with self.assertRaises(ValueError):self.convert(value,scale)
 def test_encoding_boundary_and_public_sdk_identity(self):
  self.assertEqual(self.convert(D('1.'+'0'*127),1),1)
  self.assertEqual(self.convert(D('0e-1000'),1),0)
  import market_compute_api as api
  self.assertIs(api.exact_scaled_integer,market_math.exact_scaled_integer)
  self.assertEqual(api.EXACT_NUMERIC_CONVERSION_CAPABILITIES,frozenset({'exact_scaled_integer'}))
  self.assertNotIn('exact_scaled_integer',api.ALGORITHMS)
if __name__=='__main__':unittest.main()
