"""R23 exact diagnostics, real C/H/G/F/V; observational wrapper only."""
import json
import unittest
from unittest.mock import patch
from math import sqrt
import math_universe_diagnostics as diag
from history_graph_core import kruskal_forest_v1
from math_resource_budget import BudgetCounter, BudgetLimits

class IntegratedForest(unittest.TestCase):
    def test_actual_diagnostics_twice(self):
        for n in (2,4,8):
            with self.subTest(n=n):
                support=tuple((1000*(i+1),(float(i),float(i%2),0.,0.)) for i in range(n))
                b=BudgetCounter(BudgetLimits(*([10**12]*5)))
                b.reserve_memory(59)
                calls=[]
                def observe(ids,edges,counter):
                    self.assertIs(counter,b)
                    before=b.snapshot()
                    forest=kruskal_forest_v1(ids,edges,counter)
                    after=b.snapshot()
                    calls.append((ids,edges,forest,{k:after[k]-before[k] for k in ('ops','read_bytes','write_bytes','output_bytes')}))
                    return forest
                with patch.object(diag,'kruskal_forest_v1',side_effect=observe), patch('history_graph_core.kruskal_forest_v1',side_effect=observe):
                    result=diag.analyze_aligned_support(support,budget=b)
                self.assertEqual(len(calls),2)
                self.assertEqual(calls[0],calls[1])
                self.assertEqual(result['geometry']['pairwise_distances'][0],sqrt(2))
                self.assertEqual(len(result['geometry']['forest']['edges']),n-1)
                self.assertEqual(result['geometry']['forest']['components'],(tuple(f'state{i:03}' for i in range(n)),))
                self.assertIs(result['execution_authority'],False)
                self.assertIs(result['trading_authorized'],False)
                size=len(json.dumps(result,separators=(',',':'),allow_nan=False).encode())
                snap=b.snapshot()
                self.assertEqual(snap['live_bytes'],59+size)
                self.assertEqual(snap['by_kind']['graph.edge'],n*(n-1))
                print(json.dumps({'n':n,'graph_calls':len(calls),'duplicate':calls[1][3],'total_ops':snap['ops'],'retained_result_bytes':size,'peak_live':snap['peak_bytes']}),flush=True)
                b.release_memory(size)
                self.assertEqual(b.snapshot()['live_bytes'],59)
                b.release_memory(59)

    def test_9_state_no_graph(self):
        b=BudgetCounter(BudgetLimits(*([10**12]*5)))
        support=tuple((1000*(i+1),(float(i),float(i%2),0.,0.)) for i in range(9))
        result=diag.analyze_aligned_support(support,budget=b)
        self.assertEqual(result['geometry'],{'status':'NOT_RUN','reason':'PAIRWISE_SUPPORT_LIMIT_8'})
        self.assertEqual(b.snapshot()['by_kind'].get('graph.edge',0),0)
        b.release_memory(len(json.dumps(result,separators=(',',':'),allow_nan=False).encode()))
        self.assertEqual(b.snapshot()['live_bytes'],0)

if __name__=='__main__': unittest.main(verbosity=2)
