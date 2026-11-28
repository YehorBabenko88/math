"""Agent C Round27: independent reference oracles on genuine exact X10 C/H/G/F/V diagnostics."""
from decimal import Decimal, localcontext
from fractions import Fraction
from itertools import combinations
import hashlib
import json
import math
import struct
import unittest
from math_universe_diagnostics import analyze_aligned_support
from math_resource_budget import BudgetCounter, BudgetLimits, BudgetExceeded

LIMIT = 10**12

def budget(*, ops=LIMIT, read=LIMIT, write=LIMIT, live=LIMIT, output=LIMIT):
    return BudgetCounter(BudgetLimits(ops, read, write, live, output))

def independent_distance(a,b):
    with localcontext() as c:
        c.prec = 1700
        sq = sum((Decimal.from_float(x) - Decimal.from_float(y))**2 for x,y in zip(a,b))
        return float(sq.sqrt())

def sample(n,d,func):
    return tuple(((i+1)*1000,tuple(float(func(i,j)) for j in range(d))) for i in range(n))

def run(s):
    b=budget(); r=analyze_aligned_support(s,budget=b)
    return r,b

def prim_weight(n, pairs, values):
    d={}
    for (i,j),value in zip(pairs,values):
        d[i,j]=d[j,i]=Fraction(value)
    tree={0}; total=Fraction()
    while len(tree)<n:
        w,i,j=min((d[i,j],i,j) for i in tree for j in range(n) if j not in tree)
        total+=w;tree.add(j)
    return total

class X10IndependentDiagnostic(unittest.TestCase):
    def test_4d_decimal_pairwise_prim_and_shared_custody(self):
        s=sample(4,4,lambda i,j:(i+1)*(j+2) if j%2 else (i-j))
        r,b=run(s);g=r['geometry']
        self.assertEqual(g['status'],'COMPUTED')
        self.assertEqual(g['pair_order'],tuple(combinations(range(4),2)))
        self.assertEqual(g['pairwise_distances'],tuple(independent_distance(s[i][1],s[j][1]) for i,j in g['pair_order']))
        self.assertEqual(sum((Fraction(w) for _,_,w in g['forest']['edges']),Fraction()),prim_weight(4,g['pair_order'],g['pairwise_distances']))
        self.assertEqual(len(g['forest']['components']),1)
        self.assertEqual(r['status'],'DESCRIPTIVE_ONLY')
        self.assertIs(r['trading_authorized'],False)
        self.assertIs(r['execution_authority'],False)
        self.assertEqual(b.snapshot()['live_bytes'],len(json.dumps(r,separators=(',',':'),allow_nan=False).encode()))
        b.release_memory(b.snapshot()['live_bytes']);self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_32d_8states_28_distances_decimal_and_budget(self):
        s=sample(8,32,lambda i,j: ((i+3)*(j+7)%23 - 11) / 8)
        r,b=run(s);g=r['geometry'];self.assertEqual(g['status'],'COMPUTED')
        self.assertEqual(len(g['pairwise_distances']),28)
        for (i,j),actual in zip(g['pair_order'],g['pairwise_distances']):
            self.assertEqual(struct.pack('>d',actual),struct.pack('>d',independent_distance(s[i][1],s[j][1])))
        self.assertEqual(sum((Fraction(w) for _,_,w in g['forest']['edges']),Fraction()),prim_weight(8,g['pair_order'],g['pairwise_distances']))
        snapshot=b.snapshot();self.assertGreater(snapshot['ops'],0);self.assertGreater(snapshot['read_bytes'],0)
        self.assertGreater(snapshot['output_bytes'],0)
        self.assertEqual(snapshot['live_bytes'],len(json.dumps(r,separators=(',',':'),allow_nan=False).encode()))
        b.release_memory(snapshot['live_bytes']);self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_4d_square_has_persistent_h1_until_diagonal(self):
        pts=((0.,0.,0.,0.),(0.,1.,0.,0.),(1.,0.,0.,0.),(1.,1.,0.,0.))
        s=tuple(((i+1)*1000,p) for i,p in enumerate(pts))
        r,b=run(s); bars=r['geometry']['bars']
        self.assertIn((1,1.0,math.sqrt(2),False),bars)
        self.assertEqual(len([x for x in bars if x[0]==0 and x[2] is None]),1)
        b.release_memory(b.snapshot()['live_bytes'])

    def test_32d_degenerate_zero_vectors_are_descriptive_not_authorized(self):
        s=sample(4,32,lambda i,j:0)
        r,b=run(s);g=r['geometry']
        self.assertEqual(g['pairwise_distances'],(0.,)*6)
        self.assertEqual(g['status'],'COMPUTED')
        self.assertEqual(r['statistics']['first_two_features']['status'],'REFUSED')
        self.assertEqual(r['statistics']['first_two_features']['reason_code'],'CONSTANT')
        self.assertIs(r['execution_authority'],False)
        b.release_memory(b.snapshot()['live_bytes'])

    def test_9_states_refuse_pairwise_without_losing_pearson(self):
        s=sample(9,4,lambda i,j: i*(j+1)+1)
        r,b=run(s)
        self.assertEqual(r['geometry'],{'status':'NOT_RUN','reason':'PAIRWISE_SUPPORT_LIMIT_8'})
        self.assertEqual(r['statistics']['first_two_features']['status'],'OK')
        self.assertEqual(r['statistics']['first_two_features']['rho'],1.0)
        self.assertEqual(r['support_size'],9)
        b.release_memory(b.snapshot()['live_bytes'])

    def test_invalid_duplicate_timestamps_preserve_preexisting_custody(self):
        s=((1000,(1.,2.,3.,4.)),(1000,(2.,3.,4.,5.)))
        b=budget(); b.reserve_memory(111)
        with self.assertRaisesRegex(ValueError,'DIAGNOSTICS_SUPPORT'):
            analyze_aligned_support(s,budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],111)
        b.release_memory(111);self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_overflow_refuses_without_stealing_preexisting_custody(self):
        maxval=float.fromhex('0x1.fffffffffffffp+1023')
        s=((1000,(maxval,1.,2.,3.)),(2000,(-maxval,3.,2.,1.)),(3000,(1.,2.,3.,4.)))
        b=budget();b.reserve_memory(127)
        with self.assertRaisesRegex(ValueError,'NUMERIC_OVERFLOW'):
            analyze_aligned_support(s,budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],127)
        b.release_memory(127)

    def test_one_unit_output_quota_fails_closed(self):
        s=sample(3,4,lambda i,j:(i+j+1))
        b=budget(output=1)
        with self.assertRaisesRegex(ValueError,'BUDGET_EXCEEDED'):
            analyze_aligned_support(s,budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],0)
        self.assertTrue(b.snapshot()['failed'])

    def test_strict_budget_type_no_duck_typed_meter(self):
        s=sample(4,4,lambda i,j:i+j)
        with self.assertRaises(TypeError):analyze_aligned_support(s,budget=object())

    def test_repeat_is_deterministic_on_separate_real_budgets(self):
        s=sample(8,4,lambda i,j:(i*3+j*7)%11)
        r1,b1=run(s);r2,b2=run(s)
        self.assertEqual(r1,r2)
        self.assertEqual(b1.snapshot(),b2.snapshot())
        b1.release_memory(b1.snapshot()['live_bytes']);b2.release_memory(b2.snapshot()['live_bytes'])

if __name__=='__main__':unittest.main(verbosity=2)
