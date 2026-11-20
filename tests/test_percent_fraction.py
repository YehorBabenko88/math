"""Exact percent-unit conversion; no caller Decimal context or trading policy."""
import unittest
from decimal import Decimal as D,localcontext
from fractions import Fraction
import market_math as m
class PercentFractionTests(unittest.TestCase):
 def f(self,value):return m.percent_to_fraction(value)
 def test_literal_gui_and_general_percent_values(self):
  for value,expected in [('0','0'),('0.001','0.00001'),('0.06','0.0006'),('1.5','0.015'),('20','0.2'),('100','1'),('200','2'),('-50','-0.5')]:
   self.assertEqual(self.f(D(value)),D(expected))
 def test_quantum_and_signed_zero_are_preserved_by_exact_unit_shift(self):
  for value,expected in [('1.500','0.01500'),('-0.00','-0.0000'),('10.00','0.1000')]:self.assertEqual(self.f(D(value)).as_tuple(),D(expected).as_tuple())
 def test_enumerated_fraction_oracle(self):
  for coefficient in range(-100,101,7):
   for exponent in (-9,-3,0,4):
    value=D((int(coefficient<0),tuple(map(int,str(abs(coefficient)))),exponent));self.assertEqual(Fraction(self.f(value)),Fraction(value)/100)
 def test_hostile_context_all_traps_and_existing_flags_unchanged(self):
  for precision in (1,3,28):
   with localcontext() as ctx:
    ctx.prec=precision;ctx.Emin=-2;ctx.Emax=2
    for signal in ctx.traps:ctx.traps[signal]=True
    ctx.flags[next(iter(ctx.flags))]=True
    before=(ctx.prec,ctx.Emin,ctx.Emax,dict(ctx.traps),dict(ctx.flags))
    self.assertEqual(self.f(D('12345.6789')),D('123.456789'));self.assertEqual(self.f(D('1e4096')),D('1e4094'));self.assertEqual(self.f(D('1e-4096')),D('1e-4098'))
    self.assertEqual(before,(ctx.prec,ctx.Emin,ctx.Emax,dict(ctx.traps),dict(ctx.flags)))
 def test_no_implicit_coercion_or_decimal_subclass_callbacks(self):
  class Hostile:
   def __str__(self):raise AssertionError('UNTRUSTED_TEXT')
   def __float__(self):raise AssertionError('UNTRUSTED_FLOAT')
  class Subclass(D):
   def as_tuple(self):raise AssertionError('UNTRUSTED_TUPLE')
  for value in (None,True,False,0,1,1.0,'1',Hostile(),Subclass('1')):
   with self.assertRaises(ValueError):self.f(value)
 def test_nonfinite_and_coefficient_exponent_resource_bounds(self):
  for value in (D('NaN'),D('sNaN'),D('Infinity'),D('-Infinity'),D('1'*129),D('1e4097'),D('1e-4097')):
   with self.assertRaises(ValueError):self.f(value)
  self.assertEqual(len(self.f(D('9'*128)).as_tuple().digits),128)
 def test_invalid_values_do_not_change_context_flags(self):
  with localcontext() as ctx:
   for signal in ctx.traps:ctx.traps[signal]=True
   before=dict(ctx.flags)
   with self.assertRaises(ValueError):self.f(D('sNaN'))
   self.assertEqual(before,dict(ctx.flags))
 def test_api_reexports_one_canonical_kernel(self):
  import market_compute_api as api
  self.assertIs(api.percent_to_fraction,m.percent_to_fraction);self.assertEqual(api.PERCENT_NUMERIC_CAPABILITIES,frozenset({'percent_to_fraction'}))
if __name__=='__main__':unittest.main()
