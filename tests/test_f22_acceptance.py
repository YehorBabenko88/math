"""Independent acceptance cases for the exact R21 diagnostics composition.
Run only with reviewed, verified repository source files on PYTHONPATH.
"""
import itertools
import json
import math
import unittest
from math_resource_budget import BudgetCounter, BudgetLimits, BudgetExceeded
from math_universe_diagnostics import analyze_aligned_support


def support(points):
    return tuple((1000*(i+1), tuple(map(float,p))) for i,p in enumerate(points))


def meter():
    return BudgetCounter(BudgetLimits(*([10**12]*5)))


class AcceptanceF22(unittest.TestCase):
    def compute(self, points):
        b=meter()
        b.reserve_memory(73)
        result=analyze_aligned_support(support(points),budget=b)
        self.assertIs(result['execution_authority'],False)
        self.assertIs(result['trading_authorized'],False)
        size=len(json.dumps(result,separators=(',',':'),allow_nan=False).encode())
        self.assertEqual(b.snapshot()['live_bytes'],73+size)
        b.release_memory(size)
        self.assertEqual(b.snapshot()['live_bytes'],73)
        self.assertFalse(b.snapshot()['failed'])
        return result['geometry'], b.snapshot()

    def test_cube_eight_states(self):
        g,s=self.compute(tuple(itertools.product((0.,1.),repeat=3)))
        self.assertEqual(g['status'],'COMPUTED')
        self.assertEqual(g['pairwise_distances'].count(1.),12)
        self.assertEqual(g['pairwise_distances'].count(math.sqrt(2)),12)
        self.assertEqual(g['pairwise_distances'].count(math.sqrt(3)),4)
        self.assertCountEqual(g['bars'],[(0,0.,1.,False)]*7+[(0,0.,None,False)]+[(1,1.,math.sqrt(2),False)]*5)
        self.assertGreater(s['by_kind']['coordinate'],0)
        self.assertGreater(s['by_kind']['rips.pair'],0)

    def test_nine_states_refuse_pairwise(self):
        g,s=self.compute(tuple((i,i*i) for i in range(9)))
        self.assertEqual(g,{'status':'NOT_RUN','reason':'PAIRWISE_SUPPORT_LIMIT_8'})
        for kind in ('rips.pair','graph.edge','coordinate'):
            self.assertEqual(s['by_kind'].get(kind,0),0)

    def test_32d_square_exact_distances(self):
        pts=tuple((x,y)+(0.,)*30 for x,y in ((0.,0.),(1.,0.),(1.,1.),(0.,1.)))
        g,_=self.compute(pts)
        self.assertEqual(g['pairwise_distances'],(1.,math.sqrt(2),1.,1.,math.sqrt(2),1.))
        self.assertCountEqual(g['bars'],[(0,0.,1.,False)]*3+[(0,0.,None,False),(1,1.,math.sqrt(2),False)])

    def test_eight_identical_states(self):
        g,_=self.compute(((0.,)*4,)*8)
        self.assertEqual(g['pairwise_distances'],(0.,)*28)
        self.assertEqual(g['bars'],((0,0.,None,False),))

    def test_subnormal_edge(self):
        tiny=math.ulp(0.)
        g,_=self.compute(((0.,),(tiny,)))
        self.assertEqual(g['pairwise_distances'],(tiny,))
        self.assertCountEqual(g['bars'],[(0,0.,tiny,False),(0,0.,None,False)])

    def test_overflow_refuses_preserving_caller_custody(self):
        b=meter(); b.reserve_memory(73)
        with self.assertRaisesRegex(ValueError,'NUMERIC_OVERFLOW'):
            analyze_aligned_support(support(((1e308,),(-1e308,))),budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],73)

    def test_budget_refusal_preserves_caller_custody(self):
        for i in range(5):
            limits=[10**12]*5
            limits[i]=73 if i==3 else 0
            b=BudgetCounter(BudgetLimits(*limits));b.reserve_memory(73)
            with self.assertRaises(BudgetExceeded):
                analyze_aligned_support(support(((0.,0.),(1.,0.))),budget=b)
            self.assertTrue(b.snapshot()['failed'])
            self.assertEqual(b.snapshot()['live_bytes'],73)

if __name__=='__main__':
    unittest.main()
