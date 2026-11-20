"""Literal bounded finite nonnegative validation; no source or trade authority."""
import unittest,math
from decimal import Decimal,localcontext
import market_math as m
class FiniteNonnegativeTests(unittest.TestCase):
 def f(self,value):return m.finite_nonnegative_number_valid(value)
 def test_literal_finite_nonnegative_values_and_negative_zero(self):
  for value in (0,1,2**53,2**1023,0.0,-0.0,5e-324,0.0005,1.7976931348623157e308):self.assertIs(self.f(value),True)
 def test_negative_and_nonfinite_values_refuse(self):
  for value in (-1,-2**1023,-5e-324,-1.0,float('nan'),float('inf'),float('-inf')):self.assertIs(self.f(value),False)
 def test_no_coercion_or_subclass_callbacks(self):
  class Hostile:
   def __float__(self):raise AssertionError('UNTRUSTED_FLOAT')
   def __ge__(self,other):raise AssertionError('UNTRUSTED_COMPARE')
  class Float(float):
   def __float__(self):raise AssertionError('SUBCLASS_FLOAT')
  class Int(int):
   def bit_length(self):raise AssertionError('SUBCLASS_BITS')
  class HostileMeta(type):
   def __eq__(cls,other):raise AssertionError('UNTRUSTED_TYPE_EQUALITY')
  class MetaValue(metaclass=HostileMeta):pass
  class EqualMeta(type):
   def __eq__(cls,other):return True
  class EqualValue(metaclass=EqualMeta):
   def __float__(self):raise AssertionError('UNTRUSTED_METACLASS_COERCION')
  for value in (None,True,False,'1',Decimal('1'),Decimal('sNaN'),Hostile(),Float(1),Int(1),MetaValue(),EqualValue(),[],{}):self.assertIs(self.f(value),False)
 def test_integer_representation_bound_and_float_overflow_fail_closed(self):
  for value in (2**1024-1,2**1024,-2**1024,1<<1000000):self.assertIs(self.f(value),False)
  self.assertIs(self.f(2**1023),True)
 def test_independent_legacy_finite_nonnegative_domain_oracle(self):
  values=[i/7 for i in range(-200,201)]+[i for i in range(-20,21)]+[float('nan'),float('inf'),float('-inf')]
  for value in values:self.assertIs(self.f(value),bool(math.isfinite(value) and value>=0))
 def test_decimal_context_and_api_reexport_are_unchanged(self):
  import market_compute_api as api
  self.assertIs(api.finite_nonnegative_number_valid,m.finite_nonnegative_number_valid)
  self.assertIn('finite_nonnegative_number_valid',api.SCALAR_NUMERIC_CAPABILITIES)
  with localcontext() as ctx:
   for signal in ctx.traps:ctx.traps[signal]=True
   ctx.flags[next(iter(ctx.flags))]=True
   before=(ctx.prec,ctx.Emin,ctx.Emax,dict(ctx.traps),dict(ctx.flags))
   self.assertIs(self.f(-0.0),True);self.assertIs(self.f(Decimal('sNaN')),False)
   self.assertEqual(before,(ctx.prec,ctx.Emin,ctx.Emax,dict(ctx.traps),dict(ctx.flags)))
if __name__=='__main__':unittest.main()
