import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'python'))
from math_resource_budget import BudgetCounter,BudgetLimits,BudgetExceeded
from math_universe_diagnostics import analyze_aligned_support


def counter(**overrides):
    keys=('max_ops','max_read_bytes','max_write_bytes','max_live_bytes','max_output_bytes')
    return BudgetCounter(BudgetLimits(**{k:overrides.get(k,10**12) for k in keys}))


def support(points):
    return tuple((1000*(i+1),tuple(map(float,p))) for i,p in enumerate(points))


class DiagnosticsTests(unittest.TestCase):
    def test_three_state_triangle(self):
        b=counter()
        r=analyze_aligned_support(support(((0,0),(3,0),(0,4))),budget=b)
        self.assertEqual(r['geometry']['pairwise_distances'],(3.0,4.0,5.0))
        self.assertEqual(len(r['geometry']['forest']['edges']),2)
        self.assertEqual(r['geometry']['status'],'COMPUTED')
        self.assertEqual(r['status'],'DESCRIPTIVE_ONLY')
        self.assertIs(r['execution_authority'],False)
        self.assertIs(r['trading_authorized'],False)
        self.assertEqual(r['statistics']['first_two_features']['rho'],-0.5)
        self.assertGreater(b.snapshot()['live_bytes'],0)
        json.dumps(r,allow_nan=False)

    def test_square_cycle_has_known_death(self):
        r=analyze_aligned_support(support(((0,0),(1,0),(1,1),(0,1))),budget=counter())
        self.assertEqual([bar for bar in r['geometry']['bars'] if bar[0]==1],[(1,1.0,2**0.5,False)])
        self.assertEqual(r,analyze_aligned_support(support(((0,0),(1,0),(1,1),(0,1))),budget=counter()))

    def test_constant_and_insufficient_are_data_driven(self):
        r=analyze_aligned_support(support(((0,1),(0,2),(0,3),(0,4))),budget=counter())
        self.assertEqual(r['statistics']['first_two_features']['reason_code'],'CONSTANT')
        self.assertEqual(r['statistics']['adjacent_by_feature'][0]['reason_code'],'CONSTANT')
        self.assertEqual(r['statistics']['adjacent_by_feature'][1]['rho'],1.0)
        short=analyze_aligned_support(support(((0,1),)),budget=counter())
        self.assertEqual(short['statistics']['first_two_features']['reason_code'],'INSUFFICIENT_OVERLAP')
        self.assertEqual(short['geometry']['reason'],'INSUFFICIENT_SUPPORT')

    def test_large_support_explicitly_limits_geometry(self):
        r=analyze_aligned_support(support(tuple((i,i*i) for i in range(9))),budget=counter())
        self.assertEqual(r['geometry'],{'status':'NOT_RUN','reason':'PAIRWISE_SUPPORT_LIMIT_8'})
        self.assertEqual(r['statistics']['first_two_features']['status'],'OK')

    def test_zero_correlation_and_exact_retained_result_custody(self):
        b=counter();b.reserve_memory(59)
        r=analyze_aligned_support(support(((-1,1),(0,0),(1,1))),budget=b)
        self.assertEqual(r['statistics']['first_two_features']['rho'],0.0)
        size=len(json.dumps(r,separators=(',',':'),allow_nan=False).encode())
        self.assertEqual(b.snapshot()['live_bytes'],59+size)
        self.assertGreater(b.snapshot()['by_kind']['coordinate'],0)
        self.assertGreater(b.snapshot()['by_kind']['pearson'],0)
        self.assertGreater(b.snapshot()['by_kind']['graph.edge'],0)
        self.assertGreater(b.snapshot()['by_kind']['rips.pair'],0)

    def test_output_exhaustion_releases_all_new_memory(self):
        b=counter(max_output_bytes=0);b.reserve_memory(23)
        with self.assertRaises(BudgetExceeded):
            analyze_aligned_support(support(((0,0),(1,1),(2,3))),budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],23)

    def test_fake_and_exhausted_budget(self):
        for b in (None,object()):
            with self.assertRaises(TypeError): analyze_aligned_support((),budget=b)
        b=counter(max_live_bytes=100)
        b.reserve_memory(31)
        with self.assertRaises(BudgetExceeded): analyze_aligned_support(support(((0,0),(1,1))),budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],31)

    def test_invalid_input_and_numeric_failure_preserve_caller_memory(self):
        for points in (((1.0,), (1.0,2.0)),((True,),(1.0,))):
            b=counter(); b.reserve_memory(17)
            with self.assertRaises(ValueError): analyze_aligned_support(tuple((i,tuple(p)) for i,p in enumerate(points)),budget=b)
            self.assertEqual(b.snapshot()['live_bytes'],17)
        b=counter();b.reserve_memory(17)
        with self.assertRaisesRegex(ValueError,'NUMERIC_OVERFLOW'):
            analyze_aligned_support(support(((1e308,),(-1e308,))),budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],17)

if __name__=='__main__': unittest.main()
