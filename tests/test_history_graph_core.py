"""Developer regression tests with the canonical V counter."""
import unittest
from history_graph_core import kruskal_forest_v1
from math_resource_budget import BudgetCounter, BudgetLimits


def meter(cap=10**10):
    return BudgetCounter(BudgetLimits(cap,cap*4,cap*4,cap,cap))


class ForestTests(unittest.TestCase):
    def test_tie(self):
        ids=(b'A',b'B',b'C',b'D')
        edges=tuple((a,b,1.0) for i,a in enumerate(ids) for b in ids[i+1:])
        c=meter()
        result=kruskal_forest_v1(ids,edges[::-1],c)
        self.assertEqual(result.accepted_edges,((b'A',b'B',1.0),(b'A',b'C',1.0),(b'A',b'D',1.0)))
        self.assertEqual(result.components,(ids,))
        self.assertEqual(c.snapshot()['live_bytes'],0)
        self.assertEqual(c.snapshot()['output_bytes'],664)
    def test_isolated(self):
        c=meter()
        result=kruskal_forest_v1((b'A',b'B',b'C'),((b'A',b'C',-0.0),),c)
        self.assertEqual(result.components,((b'A',b'C'),(b'B',)))
        self.assertEqual(result.accepted_edges[0][2].hex(),"0x0.0p+0")
    def test_invalid(self):
        for edges in (((b'A',b'B',float('nan')),),((b'B',b'A',1.0),),((b'A',b'B',1),)):
            c=meter()
            with self.assertRaises(ValueError):
                kruskal_forest_v1((b'A',b'B'),edges,c)
            self.assertEqual(c.snapshot()['live_bytes'],0)
            self.assertEqual(c.snapshot()['output_bytes'],0)
    def test_fake_counter(self):
        class Fake:
            def __getattribute__(self, name):
                raise AssertionError("caller callback executed")
        class Derived(BudgetCounter):
            pass
        for c in (None,Fake(),Derived(BudgetLimits(1,1,1,1,1))):
            with self.assertRaisesRegex(ValueError,"BUDGET_EXCEEDED"):
                kruskal_forest_v1((b'A',),(),c)
    def test_preflight_refusal(self):
        c=meter(1)
        with self.assertRaisesRegex(ValueError,"BUDGET_EXCEEDED"):
            kruskal_forest_v1((b'A',),(),c)
        snap=c.snapshot()
        self.assertTrue(snap['failed'])
        self.assertEqual((snap['ops'],snap['live_bytes'],snap['output_bytes']),(0,0,0))
    def test_terminal_cleanup(self):
        c=meter()
        for i in range(244):
            c.charge("test."+str(i))
        with self.assertRaisesRegex(ValueError,"BUDGET_EXCEEDED"):
            kruskal_forest_v1((b'A',),(),c)
        self.assertTrue(c.snapshot()['failed'])
        self.assertEqual(c.snapshot()['live_bytes'],0)
        self.assertEqual(c.snapshot()['output_bytes'],0)
    def test_retention_is_host_responsibility(self):
        c=meter()
        result=kruskal_forest_v1((b'A',),(),c)
        self.assertEqual(result.components,((b'A',),))
        self.assertEqual(c.snapshot()['output_bytes'],64)
        self.assertEqual(c.snapshot()['live_bytes'],0)
        c.reserve_memory(64)
        self.assertEqual(c.snapshot()['live_bytes'],64)
        c.release_memory(64)
