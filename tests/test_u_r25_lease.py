import copy
import pickle
import unittest
from math_universe_research_kernel import run_synthetic_geometry_v1
from math_resource_budget import BudgetCounter, BudgetLimits
from history_spherical import SphericalError

class LeaseTests(unittest.TestCase):
    def setUp(self):
        self.b = BudgetCounter(BudgetLimits(*([10**12]*5)))
        self.b.reserve_memory(37)
    def lease(self):
        return run_synthetic_geometry_v1(((1.,0.,0.,0.),(0.,1.,0.,0.)),(1000,2000),radius=1.,cadence_ms=1000,budget=self.b)
    def test_shallow_copy_cannot_consume_other_lease(self):
        a=self.lease(); b=self.lease(); both=self.b.snapshot()['live_bytes']
        retained=(both-37)//2
        try:
            duplicate=copy.copy(a)
        except (TypeError, ValueError):
            self.assertEqual(self.b.snapshot()['live_bytes'],both)
            a.release(); b.release(); self.assertEqual(self.b.snapshot()['live_bytes'],37); return
        a.release()
        try: duplicate.release()
        except (TypeError, ValueError): pass
        self.assertEqual(self.b.snapshot()['live_bytes'],37+retained,'duplicate consumed independent lease custody')
        b.release()
    def test_deepcopy_denied(self):
        a=self.lease(); before=self.b.snapshot()
        with self.assertRaises((TypeError,ValueError)): copy.deepcopy(a)
        self.assertEqual(self.b.snapshot(),before)
        a.release(); self.assertEqual(self.b.snapshot()['live_bytes'],37)
    def test_pickle_denied(self):
        a=self.lease(); before=self.b.snapshot()
        with self.assertRaises((TypeError,ValueError)): pickle.dumps(a)
        self.assertEqual(self.b.snapshot(),before)
        a.release(); self.assertEqual(self.b.snapshot()['live_bytes'],37)
    def test_original_alias_single_release(self):
        a=self.lease(); alias=a; a.release()
        with self.assertRaises(SphericalError): alias.release()
        self.assertEqual(self.b.snapshot()['live_bytes'],37)

if __name__=='__main__': unittest.main()
