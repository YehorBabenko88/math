import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'python'))
from history_causal import Row
from math_resource_budget import BudgetCounter,BudgetLimits
import math_universe_research_kernel as kernel
from math_universe_research_engine import run_research_v1

def request(missing=False,as_of=4000):
 roster=('a','b','c','d')
 return dict(start_ms=0,end_ms=3000,as_of_ms=as_of,cadence_ms=1000,roster=roster,
  rows=tuple(Row(s,'epoch',t,t,0,float(i==t//1000-1)) for t in (1000,2000,3000) if not(missing and t==2000) for i,s in enumerate(roster)))

class BridgeTests(unittest.TestCase):
 def test_shared_budget_retains_result(self):
  b=BudgetCounter(BudgetLimits(*([10**9]*5)))
  lease=kernel.run_synthetic_geometry_v1(((1.,0.,0.,0.),(0.,1.,0.,0.)),(0,1000),radius=1.,cadence_ms=1000,budget=b)
  self.assertIsNotNone(lease.result)
  self.assertGreater(b.snapshot()['by_kind']['coordinate'],0)
  self.assertGreater(b.snapshot()['live_bytes'],0)
  self.assertGreater(b.snapshot()['output_bytes'],0)
  lease.release()
  self.assertEqual(b.snapshot()['live_bytes'],0)
 def test_bridge_preserves_canonical_I_window_and_gap(self):
  r=run_research_v1(request(True))
  self.assertEqual(r['requested'],dict(start_ms=0,end_ms=3000,as_of_ms=4000,cadence_ms=1000))
  self.assertEqual(r['gaps'],(2000,))
  self.assertEqual(len(r['alignment']['segments']),2)
  self.assertEqual(r['status'],'ABSTAIN')
  self.assertEqual(r['authority'],'NONE')
 def test_real_geometry_remains_unqualified(self):
  r=run_research_v1(request())
  self.assertTrue(r['applicability']['geometry'])
  self.assertIsNotNone(r['geometry']['trajectory'])
  self.assertEqual(r['status'],'ABSTAIN')
 def test_complete_support_composes_existing_statistics_graph_and_topology(self):
  b=BudgetCounter(BudgetLimits(*([10**9]*5)))
  r=run_research_v1(request(),budget=b)
  self.assertEqual(r['diagnostics']['status'],'DESCRIPTIVE_ONLY')
  self.assertEqual(r['diagnostics']['geometry']['status'],'COMPUTED')
  self.assertEqual(len(r['diagnostics']['geometry']['forest']['components']),1)
  self.assertFalse(r['diagnostics']['trading_authorized'])
 def test_exhaustion_releases_temporary_memory(self):
  b=BudgetCounter(BudgetLimits(1,1000000,1000000,1000000,1000000))
  with self.assertRaises(ValueError): run_research_v1(request(),budget=b)
  self.assertEqual(b.snapshot()['live_bytes'],0)
 def test_available_equal_as_of_is_excluded_by_I(self):
  r=run_research_v1(request(as_of=3000))
  self.assertEqual(r['gaps'],(3000,))
  self.assertIsNone(r['geometry'])
if __name__=='__main__': unittest.main()

class AlignmentBudgetPreflightTests(unittest.TestCase):
 def test_live_exhaustion_refuses_before_alignment(self):
  from unittest.mock import patch
  import math_universe_research_engine as engine
  from math_resource_budget import BudgetExceeded
  b=BudgetCounter(BudgetLimits(10**9,10**9,10**9,0,10**9))
  with patch.object(engine,'align',side_effect=AssertionError('alignment executed before preflight')) as calls:
   with self.assertRaises(BudgetExceeded): engine.run_research_v1(request(True),budget=b)
   calls.assert_not_called()
  self.assertEqual(b.snapshot()['live_bytes'],0)
 def test_incomplete_window_charges_alignment_io(self):
  b=BudgetCounter(BudgetLimits(*([10**9]*5)))
  run_research_v1(request(True),budget=b)
  self.assertGreater(b.snapshot()['read_bytes'],0)
  self.assertGreater(b.snapshot()['write_bytes'],0)
  self.assertGreater(b.snapshot()['peak_bytes'],b.snapshot()['live_bytes'])

class AlignmentFailureCustodyTests(unittest.TestCase):
 def test_invalid_alignment_releases_staging_and_preserves_caller_custody(self):
  b=BudgetCounter(BudgetLimits(*([10**9]*5)))
  b.reserve_memory(123)
  q=request();q['rows']=(object(),)
  with self.assertRaises(ValueError): run_research_v1(q,budget=b)
  self.assertEqual(b.snapshot()['live_bytes'],123)

class EstablishedELeaseIntegrationTests(unittest.TestCase):
 def test_detached_result_owns_exact_json_custody_and_E_scope_is_reset(self):
  import json
  import history_spherical as sphere
  b=BudgetCounter(BudgetLimits(*([10**9]*5)))
  r=run_research_v1(request(),budget=b)
  self.assertIsNone(sphere._RUNNER_BUDGET.get())
  self.assertEqual(b.snapshot()['live_bytes'],len(json.dumps(r,separators=(',',':'),allow_nan=False).encode()))
  b.release_memory(b.snapshot()['live_bytes'])
  self.assertEqual(b.snapshot()['live_bytes'],0)
