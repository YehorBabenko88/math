"""Developer tests; independent U acceptance separate."""
import unittest
from math import sqrt
from history_topology import rips_persistence_v1
from math_resource_budget import BudgetCounter, BudgetLimits


def meter(cap=10**10):
    return BudgetCounter(BudgetLimits(cap,cap*8,cap*8,cap,cap))


class TopologyTests(unittest.TestCase):
    def square(self, cutoff):
        d=sqrt(2)
        b=meter()
        result=rips_persistence_v1((b'A',b'B',b'C',b'D'),
                                  (1.,d,1.,1.,d,1.),cutoff,budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],0)
        self.assertGreater(b.snapshot()['ops'],0)
        return result

    def test_square(self):
        self.assertEqual(self.square(sqrt(2)),((0,0.,1.,False),)*3+
                         ((0,0.,None,False),(1,1.,sqrt(2),False)))

    def test_censored(self):
        self.assertIn((1,1.,None,True),self.square(1.))

    def test_triangle(self):
        r=rips_persistence_v1((b'A',b'B',b'C'),(1.,1.,1.),1.,budget=meter())
        self.assertEqual(r,((0,0.,1.,False),)*2+((0,0.,None,False),))

    def test_duplicates(self):
        r=rips_persistence_v1((b'A',b'B'),(0.,),0.,budget=meter())
        self.assertEqual(r,((0,0.,None,False),))

    def test_negative_zero(self):
        with self.assertRaisesRegex(ValueError,'METRIC_INVALID'):
            rips_persistence_v1((b'A',b'B'),(-0.,),0.,budget=meter())

    def test_budget(self):
        b=meter(1)
        with self.assertRaisesRegex(ValueError,'BUDGET_EXCEEDED'):
            rips_persistence_v1((b'A',b'B'),(1.,),1.,budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],0)
        self.assertTrue(b.snapshot()['failed'])

    def test_isolates(self):
        r=rips_persistence_v1((b'A',b'B'),(1.,),0.,budget=meter())
        self.assertEqual(r,((0,0.,None,True),)*2)
