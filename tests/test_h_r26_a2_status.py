"""H R26: independent versioned A2 status acceptance (real E/C/F/G/H/I/V)."""
import json
import unittest
from fractions import Fraction
from decimal import Decimal, localcontext
from history_causal import Row
from math_resource_budget import BudgetLimits, BudgetCounter
from math_universe_research_engine import run_research_v1
from history_spherical import _RUNNER_BUDGET


def meter():
    return BudgetCounter(BudgetLimits(*([10**12]*5)))


def request(vectors, *, omit=(), unavailable=()):
    d = len(vectors[0]); n = len(vectors)
    roster = tuple(f'feature{j}' for j in range(d))
    as_of = (n+1)*1000
    rows = tuple(Row(s,'epoch',1000*(i+1),
                     as_of if (i,j) in unavailable else 1000*(i+1),0, float(v))
                 for i,values in enumerate(vectors) for j,(s,v) in enumerate(zip(roster,values))
                 if (i,j) not in omit)
    return dict(start_ms=0,end_ms=n*1000,as_of_ms=as_of,cadence_ms=1000,
                roster=roster,rows=rows)


def oracle(x,y):
    # Centered exact rational covariance and variances; independent Decimal sqrt.
    n=len(x)
    xs=tuple(map(Fraction.from_float,x)); ys=tuple(map(Fraction.from_float,y))
    cx=n*sum(a*b for a,b in zip(xs,ys))-sum(xs)*sum(ys)
    xx=n*sum(a*a for a in xs)-sum(xs)**2
    yy=n*sum(b*b for b in ys)-sum(ys)**2
    if xx==0 or yy==0:
        return None
    with localcontext() as c:
        c.prec=500
        dc=lambda x: Decimal(x.numerator)/Decimal(x.denominator)
        return float(dc(cx)/(dc(xx)*dc(yy)).sqrt())


class A2VersionedStatusAcceptance(unittest.TestCase):
    def check_deny(self, r):
        self.assertEqual(r['status'],'ABSTAIN')
        self.assertEqual(r['authority'],'NONE')
        self.assertIs(r['qualified'],False)
        self.assertEqual(r['source_authenticity'],'NOT_EVALUATED_BY_MATH')
        self.assertFalse(r['alignment']['execution_authority'])
        self.assertFalse(r['alignment']['trading_authorized'])
        self.assertIsNone(_RUNNER_BUDGET.get())

    def test_complete_nonzero_4d_normalization_and_trajectory(self):
        pts=((1.,0.,0.,0.),(0.,1.,0.,0.),(0.,0.,1.,0.),(0.,0.,0.,1.))
        b=meter(); r=run_research_v1(request(pts),budget=b)
        self.check_deny(r)
        self.assertEqual(r['applicability']['normalization'],True)
        self.assertEqual(r['applicability']['trajectory'],True)
        self.assertEqual(r['applicability']['geometry'],True)
        self.assertIsNotNone(r['geometry']['trajectory'])
        self.assertEqual(r['diagnostics']['geometry']['status'],'COMPUTED')
        rho=r['diagnostics']['statistics']['first_two_features']['rho']
        self.assertEqual(rho,oracle(tuple(row[0] for row in pts),tuple(row[1] for row in pts)))
        self.assertEqual(rho,-1/3)
        self.assertGreater(b.snapshot()['by_kind']['pearson'],0)
        self.assertGreater(b.snapshot()['by_kind']['rips.pair'],0)
        data_bytes=len(json.dumps(r,separators=(',',':'),allow_nan=False).encode())
        self.assertEqual(b.snapshot()['live_bytes'],data_bytes)
        b.release_memory(data_bytes)
        self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_zero_direction_4d_normalization_true_trajectory_false(self):
        pts=((0.,0.,0.,0.),(1.,0.,0.,0.),(0.,1.,0.,0.),(0.,0.,1.,0.))
        b=meter();r=run_research_v1(request(pts),budget=b)
        self.check_deny(r)
        self.assertEqual(r['applicability']['normalization'],True)
        self.assertEqual(r['applicability']['trajectory'],False)
        self.assertEqual(r['applicability']['geometry'],False)
        self.assertEqual(r['geometry']['reason'],'ZERO_DIRECTION')
        self.assertEqual(r['reason'],'ZERO_DIRECTION')
        self.assertIsNone(r['geometry']['trajectory'])
        self.assertEqual(r['diagnostics']['geometry']['status'],'COMPUTED')
        first=r['diagnostics']['statistics']['first_two_features']
        self.assertEqual(first['status'],'OK')
        self.assertEqual(first['rho'],oracle(tuple(row[0] for row in pts),tuple(row[1] for row in pts)))
        self.assertGreater(b.snapshot()['by_kind']['pearson'],0)
        self.assertGreater(b.snapshot()['by_kind']['graph.edge'],0)
        self.assertGreater(b.snapshot()['by_kind']['rips.pair'],0)

    def test_incomplete_window_disables_both_statuses_without_computation(self):
        pts=((1.,0.,0.,0.),(0.,1.,0.,0.),(0.,0.,1.,0.),(0.,0.,0.,1.))
        for label, opts, gap in (
            ('leading',{'omit':{(0,0)}},1000),
            ('internal',{'omit':{(1,2)}},2000),
            ('trailing',{'omit':{(3,3)}},4000),
            ('as_of',{'unavailable':{(2,1)}},3000),
        ):
            with self.subTest(label=label):
                b=meter(); r=run_research_v1(request(pts,**opts),budget=b)
                self.check_deny(r)
                self.assertEqual(r['gaps'],(gap,))
                self.assertEqual(r['requested']['start_ms'],0)
                self.assertEqual(r['requested']['end_ms'],4000)
                self.assertIs(r['applicability']['normalization'],False)
                self.assertIs(r['applicability']['trajectory'],False)
                self.assertIs(r['applicability']['geometry'],False)
                self.assertIsNone(r['geometry']);self.assertIsNone(r['diagnostics'])
                self.assertEqual(r['reason'],'INCOMPLETE_AS_OF_WINDOW')
                self.assertEqual(b.snapshot()['by_kind'].get('pearson',0),0)
                self.assertEqual(b.snapshot()['by_kind'].get('rips.pair',0),0)
                self.assertEqual(b.snapshot()['by_kind'].get('coordinate',0),0)

    def test_constant_32d_preserves_descriptive_refusal_without_authority(self):
        pts=tuple(tuple(1.0 if j==0 else float((i+j)%3) for j in range(32)) for i in range(3))
        r=run_research_v1(request(pts),budget=meter())
        self.check_deny(r)
        self.assertIs(r['applicability']['normalization'],True)
        self.assertIs(r['applicability']['trajectory'],True)
        self.assertIs(r['applicability']['geometry'],True)
        self.assertEqual(r['diagnostics']['statistics']['first_two_features']['reason_code'],'CONSTANT')
        self.assertEqual(len(r['diagnostics']['statistics']['adjacent_by_feature']),32)
        self.assertFalse(r['applicability']['spectral']['structurally_eligible'])
        self.assertIn('CONSTANT_SERIES',r['applicability']['spectral']['reasons'])
        self.assertEqual(r['diagnostics']['geometry']['status'],'COMPUTED')

    def test_two_samples_pearson_refuses_but_geometry_status_true(self):
        pts=((1.,0.,0.,0.),(0.,1.,0.,0.))
        r=run_research_v1(request(pts),budget=meter())
        self.check_deny(r)
        self.assertTrue(r['applicability']['normalization'])
        self.assertTrue(r['applicability']['trajectory'])
        self.assertTrue(r['applicability']['geometry'])
        self.assertEqual(r['diagnostics']['statistics']['first_two_features']['reason_code'],'INSUFFICIENT_OVERLAP')
        self.assertIsNone(r['diagnostics']['statistics']['first_two_features']['rho'])
        self.assertEqual(r['diagnostics']['geometry']['status'],'COMPUTED')

if __name__=='__main__':
    unittest.main(verbosity=2)
