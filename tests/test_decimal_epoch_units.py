"""Literal epoch boundaries and precision-independent floor oracles."""
from decimal import Decimal as D,localcontext
import unittest
from market_math import decimal_epoch_units

class DecimalEpochUnitsTests(unittest.TestCase):
 def test_literal_millisecond_and_microsecond_floor_oracles(self):
  cases=[('0',0,0),('-0',0,0),('0.0000009',0,0),('0.000001',0,1),('0.0009999',0,999),('1.23456789',1234,1234567),('1790000000.123456789',1790000000123,1790000000123456),('253402300799.999999999',253402300799999,253402300799999999),('1e-1000',0,0),('1e-1001',0,0),('1e-999999999',0,0),('0e-999999999',0,0),('0e999999999',0,0),('-0e999999999',0,0)]
  for precision in (1,2,7,28):
   with localcontext() as ctx:
    ctx.prec=precision;ctx.Emin=-2;ctx.Emax=2
    for signal in ctx.traps:ctx.traps[signal]=True
    for text,ms,us in cases:
     for value in (text,D(text)):
      self.assertEqual(decimal_epoch_units(value,3),ms)
      self.assertEqual(decimal_epoch_units(value,6),us)
    self.assertFalse(any(ctx.flags.values()))
 def test_strict_domain_refusals_leave_context_untouched(self):
  invalid=[True,False,1,1.2,None,[],D('NaN'),D('sNaN'),D('Infinity'),D('-Infinity'),D('-0.00000000001'),D('253402300800'),'bad','1e999999999999999999999999999999999','x'*257,'1.'+'1'*128,D('-1e-999999999'),D('1e999999999')]
  for precision in (2,7,28):
   for traps in (False,True):
    with localcontext() as ctx:
     ctx.prec=precision
     for signal in ctx.traps:ctx.traps[signal]=traps
     ctx.clear_flags()
     for value in invalid:
      with self.subTest(value=value),self.assertRaises(ValueError):decimal_epoch_units(value,3)
     self.assertFalse(any(ctx.flags.values()))
 def test_precision_is_literal_three_or_six_and_export_is_canonical(self):
  from market_compute_api import decimal_epoch_units as exported
  self.assertIs(exported,decimal_epoch_units)
  for precision in (True,False,3.0,'3',0,2,7,None):
   with self.subTest(precision=precision),self.assertRaises(ValueError):decimal_epoch_units('1',precision)
 def test_bounded_coefficient_and_exponent_boundary(self):
  self.assertEqual(decimal_epoch_units('0.'+'0'*126+'1',6),0)
  self.assertEqual(decimal_epoch_units(D((0,(0,),-1000)),3),0)
  self.assertEqual(decimal_epoch_units(D((0,(1,)*128,-128)),6),111111)
