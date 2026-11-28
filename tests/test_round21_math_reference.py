"""Independent Round21 reference checks; stdlib or exhaustive small models only."""
from decimal import Decimal, localcontext
from fractions import Fraction
from itertools import combinations
from pathlib import Path
import math
import random
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import history_metric_core as c
from history_graph_core import kruskal_forest_v1
from history_pearson import pearson_aligned_v1
from history_spherical import spherical_apply
from history_topology import rips_persistence_v1
from math_resource_budget import BudgetCounter, BudgetLimits


def budget():
    return BudgetCounter(BudgetLimits(*([10**12] * 5)))


def partition(vertices, edges):
    """Reachability flood fill, deliberately independent of production DSU."""
    unseen = set(vertices)
    groups = []
    while unseen:
        reached = {min(unseen)}
        while True:
            grown = reached | {v for a, b, *_ in edges for u, v in ((a,b),(b,a)) if u in reached}
            if grown == reached:
                break
            reached = grown
        unseen -= reached
        groups.append(tuple(sorted(reached)))
    return tuple(sorted(groups))


class Round21IndependentReferences(unittest.TestCase):
    def test_exact_fraction_multiplication_and_division_ieee_boundaries(self):
        # Fraction supplies exact represented-input arithmetic and CPython's
        # independent correctly-rounded conversion, not C's helper functions.
        samples = [0.0, -0.0, math.ulp(0.0), math.ldexp(1.0,-1022),
                   math.nextafter(1.0,0.0), 1.0, math.nextafter(1.0,2.0),
                   -3.0, math.ldexp(1.0,500), sys.float_info.max]
        ceiling = Fraction(sys.float_info.max)
        for a in samples:
            for b in samples:
                for operation, exact in ((c.checked_mul, Fraction(a)*Fraction(b)),
                                        (c.checked_div, None if b == 0 else Fraction(a)/Fraction(b))):
                    with self.subTest(a=a,b=b,operation=operation.__name__):
                        if exact is None:
                            with self.assertRaisesRegex(ValueError,'ZERO_DIVISOR'):
                                operation(a,b)
                        elif abs(exact)>ceiling:
                            with self.assertRaisesRegex(ValueError,'NUMERIC_OVERFLOW'):
                                operation(a,b)
                        elif exact and float(exact)==0:
                            with self.assertRaisesRegex(ValueError,'NUMERIC_UNDERFLOW'):
                                operation(a,b)
                        else:
                            self.assertEqual(operation(a,b),float(exact))

    def test_norm_reference_decimal_extremes(self):
        for values in ((3.0,4.0),(math.ulp(0.0),math.ulp(0.0)),
                       (1e200,1e200),(1e-200,-1e-200),
                       (sys.float_info.max,0.0)):
            with self.subTest(values=values), localcontext() as context:
                context.prec=1600
                squared=sum(Decimal.from_float(x)**2 for x in values)
                self.assertEqual(c.checked_norm(values),float(squared.sqrt()))
        with self.assertRaisesRegex(ValueError,'NUMERIC_OVERFLOW'):
            c.checked_norm((sys.float_info.max,sys.float_info.max))

    def test_dot_exact_cancellation(self):
        for magnitude in (1e-200,1.0,1e200,sys.float_info.max):
            x=(magnitude,magnitude,1.0)
            y=(1.0,-1.0,1.0)
            expected=float(sum((Fraction(a)*Fraction(b) for a,b in zip(x,y)),Fraction()))
            self.assertEqual(c.checked_dot(x,y),expected)

    def test_spherical_analytic_near_coincident_and_antipodal_angles(self):
        # Points on the unit circle have an analytic angle theta; atan2 is
        # independent of E's chord-length half-angle implementation.
        for theta in (0.0,1e-12,1e-8,0.25,math.pi/2,math.pi-1e-8,math.pi):
            with self.subTest(theta=theta):
                v=(math.cos(theta),math.sin(theta))
                result=spherical_apply('geodesic',{'u':(1.0,0.0),'v':v},1,2.0)
                expected=math.atan2(abs(v[1]),v[0])
                self.assertAlmostEqual(result['angle'],expected,delta=8*math.ulp(max(1.0,expected)))
                self.assertAlmostEqual(result['distance'],2*expected,delta=16*math.ulp(max(1.0,expected)))

    def test_seeded_forests_against_exhaustive_edge_subsets(self):
        vertices=(b'A',b'B',b'C',b'D')
        for seed in range(32):
            rng=random.Random(seed)
            edges=tuple((a,b,float(rng.randrange(5))) for a,b in combinations(vertices,2) if rng.random()<0.75)
            groups=partition(vertices,edges)
            need=len(vertices)-len(groups)
            candidates=[]
            for subset in combinations(edges,need):
                if partition(vertices,subset)==groups:
                    candidates.append(sum(Fraction(w) for _,_,w in subset))
            result=kruskal_forest_v1(vertices,edges,budget())
            with self.subTest(seed=seed):
                self.assertEqual(result.components,groups)
                self.assertEqual(len(result.accepted_edges),need)
                self.assertEqual(sum(Fraction(w) for _,_,w in result.accepted_edges),min(candidates))

    def test_pearson_independent_centered_decimal_formula(self):
        rng=random.Random(721)
        for seed in range(40):
            x=[float(rng.randrange(-100,101)) for _ in range(3+seed%12)]
            y=[float(rng.randrange(-100,101)) for _ in x]
            with localcontext() as context:
                context.prec=120
                a=list(map(Decimal.from_float,x)); b=list(map(Decimal.from_float,y))
                ma=sum(a)/len(a); mb=sum(b)/len(b)
                cross=sum((u-ma)*(v-mb) for u,v in zip(a,b))
                variance=sum((u-ma)**2 for u in a)*sum((v-mb)**2 for v in b)
                expected=float(cross/variance.sqrt())
            result=pearson_aligned_v1(x,y,numeric_policy_ref='0'*64)
            with self.subTest(seed=seed):
                self.assertEqual(result.status,'OK')
                self.assertEqual(result.rho,expected)

    def test_rips_equilateral_triangle_known_homology(self):
        # All three edges and the filling 2-simplex enter simultaneously:
        # two finite H0 intervals, one essential H0, no positive H1 interval.
        bars=rips_persistence_v1((b'A',b'B',b'C'),(1.0,1.0,1.0),1.0,budget=budget())
        self.assertEqual(bars,((0,0.0,1.0,False),(0,0.0,1.0,False),(0,0.0,None,False)))

    def test_rips_square_cycle_and_filling(self):
        # Square graph has one H1 cycle at side length 1. Its diagonal-length
        # simplices fill it at sqrt(2), independently known from the complex.
        diagonal=math.sqrt(2)
        packed=(1.0,diagonal,1.0,1.0,diagonal,1.0)
        ids=(b'A',b'B',b'C',b'D')
        short=rips_persistence_v1(ids,packed,1.0,budget=budget())
        full=rips_persistence_v1(ids,packed,diagonal,budget=budget())
        self.assertEqual([b for b in short if b[0]==1],[(1,1.0,None,True)])
        self.assertEqual([b for b in full if b[0]==1],[(1,1.0,diagonal,False)])

if __name__=='__main__':
    unittest.main()
