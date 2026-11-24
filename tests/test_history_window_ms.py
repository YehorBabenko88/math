"""Inclusive integer history grids; metadata and readiness remain external."""
import unittest
from decimal import localcontext,Inexact,Rounded
import market_math
class HistoryWindowTests(unittest.TestCase):
 def window(self,start,end,cadence):
  self.assertTrue(hasattr(market_math,'history_window_ms'),'missing public history-window kernel')
  return market_math.history_window_ms(start,end,cadence_minutes=cadence)
 def test_seven_original_history_and_readiness_literal_windows(self):
  for start,end,cadence,expected in [(1,1000000,1,(60000,960000)),(61000,899999,5,(300000,600000)),(61000,899999,1,(120000,840000)),(61000,899999,8,(480000,480000)),(1,1000000,480,None),(0,600000,480,(0,0)),(60000,600000,5,(300000,600000))]:
   with self.subTest(start=start,end=end,cadence=cadence):self.assertEqual(self.window(start,end,cadence),expected)
 def test_reversed_empty_singleton_and_multi_day_cadences(self):
  for start,end,cadence,expected in [(600000,300000,1,None),(1,59999,1,None),(60000,60000,1,(60000,60000)),(60001,60001,1,None),(0,0,1,(0,0)),(1,1,2**53-1,None),(0,253402300799999,2**53-1,(0,0)),(86460000,172920000,1441,(86460000,172920000)),(253402300740000,253402300799999,1,(253402300740000,253402300740000))]:
   with self.subTest(start=start,end=end,cadence=cadence):self.assertEqual(self.window(start,end,cadence),expected)
 def test_strict_literal_integer_domains_before_untrusted_operations(self):
  class Hostile:
   def __int__(self):raise AssertionError('UNTRUSTED_COERCION')
   def __lt__(self,other):raise AssertionError('UNTRUSTED_COMPARISON')
  class IntSubclass(int):pass
  bad=(True,False,None,'0',0.0,IntSubclass(0),Hostile(),-1,253402300800000,10**100)
  for value in bad:
   for pair in ((value,0),(0,value)):
    with self.assertRaises(ValueError):self.window(*pair,1)
  for value in (True,False,None,'1',1.0,IntSubclass(1),Hostile(),0,-1,2**53,10**100):
   with self.assertRaises(ValueError):self.window(0,0,value)
 def test_enumerated_grid_oracle_instead_of_rounding_formula(self):
  for cadence in (1,2,5,8,1441):
   step=cadence*60000;points=tuple(i*step for i in range(8))
   for start in (0,1,step-1,step,step+1,3*step-1):
    for end in (0,step-1,step,step+1,4*step-1,4*step):
     contained=[point for point in points if start<=point<=end]
     expected=(contained[0],contained[-1]) if contained else None
     self.assertEqual(self.window(start,end,cadence),expected)
 def test_hostile_decimal_context_traps_and_flags_unchanged(self):
  for precision in (1,3,5,28):
   with localcontext() as ctx:
    ctx.prec=precision
    for signal in ctx.traps:ctx.traps[signal]=True
    ctx.flags[Inexact]=True;ctx.flags[Rounded]=True;before=dict(ctx.flags)
    self.assertEqual(self.window(61000,899999,8),(480000,480000))
    self.assertIsNone(self.window(1,1000000,480))
    with self.assertRaises(ValueError):self.window(True,0,1)
    self.assertEqual(dict(ctx.flags),before)
 def test_direct_sdk_capability_uses_same_function(self):
  import market_compute_api as api
  self.assertTrue(hasattr(api,'HISTORY_WINDOW_NUMERIC_CAPABILITIES'),'missing history capability metadata')
  self.assertIn('history_window_ms',api.HISTORY_WINDOW_NUMERIC_CAPABILITIES)
  self.assertIs(api.history_window_ms,market_math.history_window_ms)


if __name__ == '__main__':
 suite = unittest.defaultTestLoader.loadTestsFromTestCase(HistoryWindowTests)
 if suite.countTestCases() != 6:
  raise SystemExit('HISTORY_WINDOW_EXACT_SIX_TESTS_REQUIRED')
 result = unittest.TextTestRunner(verbosity=2).run(suite)
 accepted = (result.testsRun == 6 and result.wasSuccessful()
             and not result.skipped and not result.expectedFailures
             and not result.unexpectedSuccesses)
 raise SystemExit(0 if accepted else 1)
