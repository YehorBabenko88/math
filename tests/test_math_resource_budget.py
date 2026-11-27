import unittest
from math_resource_budget import BudgetCounter, BudgetLimits, BudgetExceeded, MAX

class BudgetTests(unittest.TestCase):
    def counter(self):
        return BudgetCounter(BudgetLimits(10,20,30,40,50))
    def test_boundary_and_terminal(self):
        c=self.counter(); c.charge('coordinate',ops=10)
        with self.assertRaises(BudgetExceeded): c.charge('coordinate',ops=1)
        with self.assertRaises(BudgetExceeded): c.charge('coordinate')
        self.assertEqual(c.snapshot()['ops'],10)
    def test_atomic(self):
        c=self.counter(); c.charge('sample',ops=2,read_bytes=5)
        before=c.snapshot()
        with self.assertRaises(BudgetExceeded): c.charge('sample',ops=1,read_bytes=16)
        self.assertEqual(c.snapshot(),dict(before,failed=True))
    def test_memory(self):
        c=self.counter(); c.reserve_memory(40); c.release_memory(30); c.reserve_memory(5)
        self.assertEqual((c.snapshot()['live_bytes'],c.snapshot()['peak_bytes']),(15,40))
    def test_invalid(self):
        for v in (True,-1,MAX+1,1.5):
            with self.assertRaises(ValueError): BudgetLimits(v,0,0,0,0)
    def test_underflow(self):
        c=self.counter()
        with self.assertRaises(ValueError): c.release_memory(1)
        self.assertTrue(c.snapshot()['failed'])
    def test_shared(self):
        c=self.counter()
        def nested(b): b.charge('pivot',ops=3)
        nested(c); nested(c)
        self.assertEqual(c.snapshot()['by_kind']['pivot'],6)
    def test_zero(self):
        c=BudgetCounter(BudgetLimits(0,0,0,0,0))
        with self.assertRaises(BudgetExceeded): c.charge_output(1)
    def test_preflight(self):
        c=self.counter(); c.preflight(ops=10,live_bytes=40)
        self.assertEqual(c.snapshot()['ops'],0)
    def test_snapshot_copy(self):
        c=self.counter(); c.snapshot()['by_kind']['pivot']=99
        self.assertEqual(c.snapshot()['by_kind']['pivot'],0)
    def test_kind_cap(self):
        c=self.counter()
        for i in range(244): c.charge(f'new{i}')
        before=c.snapshot()
        with self.assertRaisesRegex(BudgetExceeded,'BUDGET_EXCEEDED'): c.charge('extra')
        self.assertEqual(c.snapshot(),dict(before,failed=True))
    def test_byte_and_cleanup(self):
        c=self.counter(); c.reserve_memory(10); c.charge('read',read_bytes=20,write_bytes=30); c.charge_output(50)
        with self.assertRaises(BudgetExceeded): c.charge_output(1)
        c.release_memory(10)
        self.assertEqual(c.snapshot()['live_bytes'],0)
        self.assertEqual(c.snapshot()['peak_bytes'],10)
