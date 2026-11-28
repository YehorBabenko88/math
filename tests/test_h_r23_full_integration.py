"""Agent H R23 independent full actual Codex Python integration checks.
No stubbed/mocked code. Source trees are verified to exact 52dbbbbb... Git blobs.
"""
import json
import unittest
from decimal import Decimal, localcontext
from fractions import Fraction

from history_causal import Row
from math_resource_budget import BudgetCounter, BudgetLimits, BudgetExceeded
from math_universe_research_engine import run_research_v1
import history_spherical

LIM=10**12

def budget(**kwargs):
    fields=('max_ops','max_read_bytes','max_write_bytes','max_live_bytes','max_output_bytes')
    return BudgetCounter(BudgetLimits(**{k:kwargs.get(k,LIM) for k in fields}))

def query(vectors, *, missing=(), unavailable=(), start=0, end=None, as_of=None):
    n=len(vectors)
    d=len(vectors[0])
    roster=tuple(f'feat{i:02d}' for i in range(d))
    end=n*1000 if end is None else end
    as_of=(n+1)*1000 if as_of is None else as_of
    rows=tuple(Row(s,'epoch',t,(as_of if (t,j) in unavailable else t),0,float(vectors[k][j]))
        for k,t in enumerate(range(1000,n*1000+1,1000))
        for j,s in enumerate(roster) if (t,j) not in missing)
    return dict(start_ms=start,end_ms=end,as_of_ms=as_of,cadence_ms=1000,roster=roster,rows=rows)

def oracle(x,y):
    # Independent centered Fraction exact Pearson moment; Decimal sqrt for nearest binary64.
    a=list(map(Fraction.from_float,x)); b=list(map(Fraction.from_float,y))
    n=len(a)
    ax=sum(a); by=sum(b)
    xx=n*sum(q*q for q in a)-ax*ax
    yy=n*sum(q*q for q in b)-by*by
    cross=n*sum(u*v for u,v in zip(a,b))-ax*by
    if not xx or not yy: return None
    with localcontext() as ctx:
        ctx.prec=500
        return float((Decimal(cross.numerator)/Decimal(cross.denominator))/
            ((Decimal(xx.numerator)/Decimal(xx.denominator))*
             (Decimal(yy.numerator)/Decimal(yy.denominator))).sqrt())

class FullExactCodexIntegration(unittest.TestCase):
    def test_4d_complete_real_all_kernels_and_fraction_oracle(self):
        vectors=((1.,0.,0.,0.),(0.,1.,0.,0.),(0.,0.,1.,0.),(0.,0.,0.,1.))
        b=budget()
        r=run_research_v1(query(vectors),budget=b)
        stats=r['diagnostics']['statistics']
        self.assertEqual(r['status'],'ABSTAIN')
        self.assertFalse(r['qualified'])
        self.assertEqual(r['authority'],'NONE')
        self.assertEqual(r['gaps'],())
        self.assertEqual(stats['first_two_features']['rho'],oracle([p[0] for p in vectors],[p[1] for p in vectors]))
        self.assertEqual(stats['first_two_features']['rho'],-1/3)
        for j,lag in enumerate(stats['adjacent_by_feature']):
            expected=oracle([p[j] for p in vectors[:-1]],[p[j] for p in vectors[1:]])
            self.assertEqual(lag['rho'],expected)
        self.assertEqual(r['diagnostics']['geometry']['status'],'COMPUTED')
        self.assertEqual(len(r['diagnostics']['geometry']['forest']['components']),1)
        self.assertIsNotNone(r['geometry']['trajectory'])
        self.assertGreater(b.snapshot()['by_kind']['pearson'],0)
        self.assertGreater(b.snapshot()['by_kind']['coordinate'],0)
        self.assertGreater(b.snapshot()['by_kind']['graph.edge'],0)
        self.assertGreater(b.snapshot()['by_kind']['rips.pair'],0)
        self.assertIsNone(history_spherical._RUNNER_BUDGET.get())
        retained=len(json.dumps(r,separators=(',',':'),allow_nan=False).encode())
        self.assertEqual(b.snapshot()['live_bytes'],retained)
        b.release_memory(retained)
        self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_4d_constant_column_retains_refusal_without_fake_causality(self):
        vectors=((1.,0.,0.,1.),(1.,1.,0.,2.),(1.,0.,1.,3.),(1.,1.,1.,4.))
        r=run_research_v1(query(vectors),budget=budget())
        self.assertEqual(r['diagnostics']['statistics']['first_two_features']['status'],'REFUSED')
        self.assertEqual(r['diagnostics']['statistics']['first_two_features']['reason_code'],'CONSTANT')
        self.assertFalse(r['applicability']['spectral']['structurally_eligible'])
        self.assertIn('CONSTANT_SERIES',r['applicability']['spectral']['reasons'])
        self.assertIs(r['qualified'],False)
        self.assertEqual(r['authority'],'NONE')
        self.assertEqual(r['status'],'ABSTAIN')

    def test_no_gap_mending_on_leading_internal_trailing_and_unavailable(self):
        vectors=((1.,0.,0.,1.),(0.,1.,0.,1.),(0.,0.,1.,1.),(1.,1.,0.,1.))
        cases=[('leading',{(1000,0)},set(),(1000,)),
               ('internal',{(2000,2)},set(),(2000,)),
               ('trailing',{(4000,3)},set(),(4000,)),
               ('unavailable',set(),{(3000,1)},(3000,))]
        for label,missing,unavailable,gap in cases:
            with self.subTest(case=label):
                b=budget()
                r=run_research_v1(query(vectors,missing=missing,unavailable=unavailable),budget=b)
                self.assertEqual(r['gaps'],gap)
                self.assertEqual(r['requested']['start_ms'],0)
                self.assertEqual(r['requested']['end_ms'],4000)
                self.assertEqual(r['status'],'ABSTAIN')
                self.assertIsNone(r['diagnostics'])
                self.assertIsNone(r['geometry'])
                self.assertFalse(r['applicability']['geometry'])
                self.assertFalse(r['applicability']['spectral']['structurally_eligible'])
                self.assertEqual(b.snapshot()['by_kind'].get('pearson',0),0)
                self.assertEqual(b.snapshot()['by_kind'].get('graph.edge',0),0)
                self.assertEqual(b.snapshot()['by_kind'].get('coordinate',0),0)
                self.assertIsNone(history_spherical._RUNNER_BUDGET.get())
                b.release_memory(b.snapshot()['live_bytes'])
                self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_4d_zero_direction_no_trajectory_but_descriptive_stats(self):
        vectors=((0.,0.,0.,0.),(1.,0.,0.,0.),(0.,1.,0.,0.),(0.,0.,1.,0.))
        r=run_research_v1(query(vectors),budget=budget())
        self.assertEqual(r['geometry']['reason'],'ZERO_DIRECTION')
        self.assertIsNone(r['geometry']['trajectory'])
        self.assertEqual(r['diagnostics']['geometry']['status'],'COMPUTED')
        self.assertEqual(r['status'],'ABSTAIN')
        # Contract ambiguity for A: applicability.geometry=True despite no trajectory.
        self.assertTrue(r['applicability']['geometry'])

    def test_4d_budget_atomic_denial_and_caller_retention(self):
        vectors=((1.,0.,0.,0.),(0.,1.,0.,0.),(0.,0.,1.,0.),(0.,0.,0.,1.))
        b=budget(max_ops=1)
        b.reserve_memory(41)
        with self.assertRaises(BudgetExceeded):
            run_research_v1(query(vectors),budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],41)
        self.assertEqual(b.snapshot()['by_kind'].get('pearson',0),0)
        self.assertIsNone(history_spherical._RUNNER_BUDGET.get())

    def test_32d_3states_real_nested_c_h_e_g_f(self):
        # 3 samples all 32 features, constant feature0, no fabricated authority.
        vectors=tuple(tuple((1.0 if j==0 else float((k+j)%3)) for j in range(32)) for k in range(3))
        r=run_research_v1(query(vectors),budget=budget())
        self.assertEqual(r['diagnostics']['feature_count'],32)
        self.assertEqual(len(r['diagnostics']['statistics']['adjacent_by_feature']),32)
        self.assertEqual(r['diagnostics']['statistics']['first_two_features']['reason_code'],'CONSTANT')
        self.assertEqual(r['diagnostics']['geometry']['status'],'COMPUTED')
        self.assertIsNotNone(r['geometry']['trajectory'])
        self.assertFalse(r['applicability']['spectral']['structurally_eligible'])
        self.assertEqual(r['status'],'ABSTAIN')

    def test_4d_two_samples_pearson_refuses_but_geometry_stays_descriptive(self):
        vectors=((1.,0.,0.,0.),(0.,1.,0.,0.))
        b=budget()
        r=run_research_v1(query(vectors),budget=b)
        first=r['diagnostics']['statistics']['first_two_features']
        self.assertEqual(first['status'],'REFUSED')
        self.assertEqual(first['reason_code'],'INSUFFICIENT_OVERLAP')
        self.assertEqual(first['n_overlap'],2)
        self.assertIsNone(first['rho'])
        self.assertEqual(r['diagnostics']['geometry']['status'],'COMPUTED')
        self.assertEqual(r['status'],'ABSTAIN')
        self.assertIs(r['qualified'],False)
        self.assertIsNone(history_spherical._RUNNER_BUDGET.get())

    def test_4d_real_C_numeric_overflow_releases_all_new_custody(self):
        vectors=((1.6e308,1.6e308,0.,0.),(0.,1.,0.,0.),(0.,0.,1.,0.))
        b=budget()
        b.reserve_memory(37)
        with self.assertRaisesRegex(ValueError,'NUMERIC_OVERFLOW'):
            run_research_v1(query(vectors),budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],37)
        self.assertIsNone(history_spherical._RUNNER_BUDGET.get())
        self.assertGreater(b.snapshot()['ops'],0) # no refund of spent logical credits

if __name__=='__main__':
    unittest.main(verbosity=2)
