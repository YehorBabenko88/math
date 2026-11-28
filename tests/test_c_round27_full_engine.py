"""New Agent C R27 tests: unmocked exact X10 I/E/C/H/G/F/V research engine."""
import copy
import json
import math
import pickle
import unittest
from decimal import Decimal,localcontext
from fractions import Fraction

from history_causal import Row
from math_resource_budget import BudgetCounter,BudgetLimits,BudgetExceeded
from math_universe_research_engine import run_research_v1
from math_universe_research_kernel import run_synthetic_geometry_v1
import history_spherical

CAP=10**12

def budget(**kwargs):
    return BudgetCounter(BudgetLimits(*(kwargs.get(k,CAP) for k in ('ops','read_bytes','write_bytes','live_bytes','output_bytes'))))

def request(states,*,as_of=10000,revision=0):
    n=len(states);d=len(states[0]);roster=tuple(f'f{i:02d}' for i in range(d))
    rows=tuple(Row(key,'epoch',t,t,revision,float(states[t//1000-1][i]))
               for t in range(1000,(n+1)*1000,1000) for i,key in enumerate(roster))
    return {'start_ms':0,'end_ms':n*1000,'as_of_ms':as_of,'cadence_ms':1000,
            'roster':roster,'rows':rows}

def axes(d,n):
    return tuple(tuple(1.0 if i==j else 0.0 for j in range(d)) for i in range(n))

class X10IntegratedCReview(unittest.TestCase):
    def test_4d_real_engine_exact_axis_geodesics_and_shared_budget(self):
        b=budget();r=run_research_v1(request(axes(4,3)),budget=b)
        self.assertEqual(r['status'],'ABSTAIN');self.assertEqual(r['authority'],'NONE')
        self.assertIs(r['qualified'],False)
        self.assertEqual(r['geometry']['trajectory']['angles'],(math.pi/2,math.pi/2))
        self.assertEqual(r['geometry']['trajectory']['distances'],(math.pi/2,math.pi/2))
        self.assertEqual(r['geometry']['trajectory']['speeds'],(math.pi/2,math.pi/2))
        self.assertEqual(r['diagnostics']['geometry']['pairwise_distances'],(math.sqrt(2),)*3)
        kinds=b.snapshot()['by_kind'];self.assertGreater(kinds['coordinate'],0)
        self.assertGreater(kinds['pearson'],0);self.assertGreater(kinds['graph.edge'],0)
        self.assertGreater(kinds['rips.pair'],0)
        self.assertEqual(b.snapshot()['live_bytes'],len(json.dumps(r,separators=(',',':'),allow_nan=False).encode()))
        self.assertIsNone(history_spherical._RUNNER_BUDGET.get())
        b.release_memory(b.snapshot()['live_bytes']);self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_32d_eight_axis_states_full_composition(self):
        b=budget();r=run_research_v1(request(axes(32,8)),budget=b)
        self.assertEqual(r['diagnostics']['feature_count'],32)
        self.assertEqual(len(r['diagnostics']['geometry']['pairwise_distances']),28)
        self.assertEqual(r['diagnostics']['geometry']['pairwise_distances'],(math.sqrt(2),)*28)
        self.assertEqual(r['geometry']['trajectory']['angles'],(math.pi/2,)*7)
        self.assertEqual(r['geometry']['trajectory']['distances'],(math.pi/2,)*7)
        self.assertEqual(r['status'],'ABSTAIN')
        self.assertIs(r['diagnostics']['trading_authorized'],False)
        self.assertIs(r['applicability']['spectral']['qualified'],False)
        b.release_memory(b.snapshot()['live_bytes']);self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_nontrivial_fraction_pearson_on_4d_full_research(self):
        states=((1.,0.,2.,3.),(4.,3.,1.,2.),(2.,5.,4.,1.),(7.,1.,3.,5.))
        b=budget();r=run_research_v1(request(states),budget=b)
        a=[Fraction.from_float(s[0]) for s in states];q=[Fraction.from_float(s[1]) for s in states]
        n=len(a);cov=n*sum(x*y for x,y in zip(a,q))-sum(a)*sum(q)
        v1=n*sum(x*x for x in a)-sum(a)**2;v2=n*sum(y*y for y in q)-sum(q)**2
        with localcontext() as c:
            c.prec=500
            oracle=float((Decimal(cov.numerator)/Decimal(cov.denominator))/
                        ((Decimal(v1.numerator)/Decimal(v1.denominator))*
                         (Decimal(v2.numerator)/Decimal(v2.denominator))).sqrt())
        self.assertEqual(r['diagnostics']['statistics']['first_two_features']['rho'],oracle)
        self.assertEqual(r['diagnostics']['geometry']['status'],'COMPUTED')
        self.assertEqual(r['status'],'ABSTAIN')
        b.release_memory(b.snapshot()['live_bytes'])

    def test_real_two_lease_no_copy_and_prior_reservation(self):
        b=budget();b.reserve_memory(31)
        states=axes(4,2);times=(1000,2000)
        first=run_synthetic_geometry_v1(states,times,radius=1.,cadence_ms=1000,budget=b)
        second=run_synthetic_geometry_v1(states,times,radius=1.,cadence_ms=1000,budget=b)
        before=b.snapshot();self.assertGreater(before['live_bytes'],31)
        for operation in (lambda:copy.copy(first),lambda:copy.deepcopy(first),lambda:pickle.loads(pickle.dumps(first))):
            with self.assertRaises(TypeError):operation()
            self.assertEqual(b.snapshot(),before)
        detached=copy.deepcopy(first.result)
        first.release()
        self.assertIsNotNone(detached['trajectory'])
        self.assertEqual(b.snapshot()['live_bytes'],31+second._retained)
        second.release();self.assertEqual(b.snapshot()['live_bytes'],31)
        b.release_memory(31)
        self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_numeric_overflow_does_not_steal_previous_research_custody(self):
        b=budget();r=run_research_v1(request(axes(4,3)),budget=b)
        prior=b.snapshot()['live_bytes'];self.assertGreater(prior,0)
        maximum=float.fromhex('0x1.fffffffffffffp+1023')
        states=((maximum,maximum,0.,0.),(0.,1.,0.,0.),(0.,0.,1.,0.))
        with self.assertRaisesRegex(ValueError,'NUMERIC_OVERFLOW'):
            run_research_v1(request(states),budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],prior)
        self.assertEqual(r['status'],'ABSTAIN')
        self.assertIsNone(history_spherical._RUNNER_BUDGET.get())
        b.release_memory(prior)

    def test_second_full_research_refused_when_output_cap_exhausted(self):
        req=request(axes(4,3));probe=budget();run_research_v1(req,budget=probe)
        first_output=probe.snapshot()['output_bytes'];probe.release_memory(probe.snapshot()['live_bytes'])
        b=budget(output_bytes=first_output+1)
        r=run_research_v1(req,budget=b);prior=b.snapshot()['live_bytes']
        with self.assertRaises(BudgetExceeded):run_research_v1(req,budget=b)
        self.assertEqual(r['status'],'ABSTAIN')
        self.assertEqual(b.snapshot()['live_bytes'],prior)
        b.release_memory(prior);self.assertEqual(b.snapshot()['live_bytes'],0)

    def test_32d_causal_asof_equal_refuses_trajectory_and_diagnostics(self):
        req=request(axes(32,3),as_of=4000)
        rows=list(req['rows']);rows[0]=Row(rows[0].series,'epoch',1000,4000,0,rows[0].value)
        req['rows']=tuple(rows)
        b=budget();r=run_research_v1(req,budget=b)
        self.assertEqual(r['gaps'],(1000,))
        self.assertIsNone(r['geometry']);self.assertIsNone(r['diagnostics'])
        self.assertIs(r['applicability']['geometry'],False)
        self.assertEqual(r['status'],'ABSTAIN')
        self.assertEqual(b.snapshot()['by_kind'].get('coordinate',0),0)
        b.release_memory(b.snapshot()['live_bytes'])

if __name__=='__main__':unittest.main(verbosity=2)
