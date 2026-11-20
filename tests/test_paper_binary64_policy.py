from decimal import Decimal as D,localcontext
import unittest
from market_profile_math import paper_scale_value,paper_size_multiplier,paper_net_pnl,paper_equity_update
class PaperBinary64PolicyTests(unittest.TestCase):
 def test_literal_products_caps_and_sequential_binary64_subtraction(self):
  self.assertEqual(paper_scale_value(2.5,3),7.5)
  self.assertEqual(paper_scale_value(-2,4),-8.0)
  self.assertEqual(paper_size_multiplier(1,2,3,4),4.0)
  self.assertEqual(paper_size_multiplier(1,-2,3,4),-8.0)
  self.assertEqual(paper_size_multiplier(1e308,2,1,4),4.0)
  self.assertEqual(paper_net_pnl(.3,.2,.1),float.fromhex('-0x1.0000000000000p-55'))
  self.assertEqual(paper_net_pnl(1e16,1,1),1e16)
 def test_literal_equity_updates_preserve_historical_tuple_policy(self):
  self.assertEqual(paper_equity_update(100,100,100,0,-10),(90.,100.,90.,10.))
  self.assertEqual(paper_equity_update(90,100,90,10,20),(110.,110.,90.,10.))
 def test_old_numeric_text_and_decimal_conversion_is_context_independent(self):
  for precision in (1,2,7,28):
   with localcontext() as ctx:
    ctx.prec=precision
    for signal in ctx.traps:ctx.traps[signal]=True
    self.assertEqual(paper_scale_value('2.5',D(3)),7.5)
    self.assertEqual(paper_net_pnl(D('.3'),D('.2'),D('.1')),float.fromhex('-0x1.0000000000000p-55'))
    self.assertFalse(any(ctx.flags.values()))
 def test_nonfinite_overflow_bool_and_bad_steps_refuse(self):
  for bad in (True,None,[],float('nan'),float('inf'),D('NaN'),'nan','x'*257,10**1000):
   with self.subTest(bad=type(bad)),self.assertRaises(ValueError):paper_scale_value(bad,1)
  for call in (lambda:paper_scale_value(1e308,2),lambda:paper_net_pnl(1e308,-1e308,0),lambda:paper_equity_update(1e308,1e308,1e308,0,1e308),lambda:paper_size_multiplier(1,1e308,2,4)):
   with self.assertRaises(ValueError):call()
  for step in (True,-1,1.0,'1',1000001):
   with self.assertRaises(ValueError):paper_size_multiplier(1,2,step,4)
 def test_canonical_sdk_exports(self):
  import market_compute_api as api
  self.assertIs(api.paper_scale_value,paper_scale_value)
  self.assertIs(api.paper_equity_update,paper_equity_update)
