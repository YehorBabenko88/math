from decimal import Decimal as D,localcontext
import unittest
from market_math import candle_ohlcv_valid
class CandleOhlcvDomainTests(unittest.TestCase):
 def test_literal_valid_and_invalid_domains_under_all_traps(self):
  for precision in (1,2,7,28):
   with localcontext() as ctx:
    ctx.prec=precision
    for signal in ctx.traps:ctx.traps[signal]=True
    self.assertTrue(candle_ohlcv_valid(D(1),D(3),D(1),D(2),D(0)))
    self.assertTrue(candle_ohlcv_valid(D(2),D(3),D(1),D(1),D('-0')))
    valid=[D(1),D(3),D(1),D(2),D(0)]
    for index in range(5):
     for value in (True,1,'1',D('NaN'),D('sNaN'),D('Infinity'),D('-Infinity'),D(-1),D('1e4097')):
      changed=valid.copy();changed[index]=value
      self.assertFalse(candle_ohlcv_valid(*changed))
    for index in (0,1,2,3):
     changed=valid.copy();changed[index]=D(0);self.assertFalse(candle_ohlcv_valid(*changed))
    self.assertFalse(candle_ohlcv_valid(D(4),D(3),D(1),D(2),D(1)))
    self.assertFalse(candle_ohlcv_valid(D(2),D(3),D(1),D(4),D(1)))
    self.assertFalse(any(ctx.flags.values()))
 def test_canonical_sdk_export(self):
  from market_compute_api import candle_ohlcv_valid as exported
  self.assertIs(exported,candle_ohlcv_valid)
