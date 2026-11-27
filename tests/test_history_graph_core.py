"""Developer-only checks; no independent acceptance or budget authority."""
import unittest
from python.history_graph_core import kruskal_forest_v1


class RecordingCounter:
    # Test spy only; not a budget implementation or production grant.
    def __init__(self):
        self.calls=[]
    def preflight(self, **kwargs):
        self.calls.append(("preflight", kwargs))
    def reserve_memory(self, size):
        self.calls.append(("reserve", size))
    def release_memory(self, size):
        self.calls.append(("release", size))
    def charge(self, kind, **kwargs):
        self.calls.append((kind, kwargs))
    def charge_output(self, size):
        self.calls.append(("output", size))


class ForestTests(unittest.TestCase):
    def test_tie(self):
        ids=(b'A',b'B',b'C',b'D')
        edges=tuple((a,b,1.0) for i,a in enumerate(ids) for b in ids[i+1:])
        c=RecordingCounter()
        result=kruskal_forest_v1(ids,edges[::-1],c)
        self.assertEqual(result.accepted_edges,((b'A',b'B',1.0),(b'A',b'C',1.0),(b'A',b'D',1.0)))
        self.assertEqual(result.components,(ids,))
        self.assertEqual(c.calls[0][0],"preflight")
        self.assertEqual(c.calls[-1][0],"release")
    def test_isolated(self):
        result=kruskal_forest_v1((b'A',b'B',b'C'),((b'A',b'C',-0.0),),RecordingCounter())
        self.assertEqual(result.components,((b'A',b'C'),(b'B',)))
        self.assertEqual(result.accepted_edges[0][2].hex(),"0x0.0p+0")
    def test_invalid(self):
        for edges in (((b'A',b'B',float('nan')),),((b'B',b'A',1.0),),((b'A',b'B',1),)):
            with self.assertRaises(ValueError):
                kruskal_forest_v1((b'A',b'B'),edges,RecordingCounter())
    def test_no_budget(self):
        with self.assertRaisesRegex(ValueError,"BUDGET_EXCEEDED"):
            kruskal_forest_v1((b'A',),(),None)
    def test_preflight_refusal(self):
        class Refusal(RecordingCounter):
            def preflight(self, **kwargs):
                raise ValueError("BUDGET_EXCEEDED")
        c=Refusal()
        with self.assertRaisesRegex(ValueError,"BUDGET_EXCEEDED"):
            kruskal_forest_v1((b'A',),(),c)
        self.assertEqual(c.calls,[])
