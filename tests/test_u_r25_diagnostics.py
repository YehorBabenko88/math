import itertools as it
import json, math, unittest
from fractions import Fraction
from decimal import Decimal, localcontext
from math_universe_diagnostics import analyze_aligned_support
from math_universe_research_kernel import run_synthetic_geometry_v1
from math_resource_budget import BudgetCounter,BudgetLimits,BudgetExceeded

def counter(**kw):
    keys=('max_ops','max_read_bytes','max_write_bytes','max_live_bytes','max_output_bytes')
    return BudgetCounter(BudgetLimits(**{k:kw.get(k,10**12) for k in keys}))

def support(points):
    return tuple((1000*(i+1),tuple(map(float,p))) for i,p in enumerate(points))

def distance(a,b):
    with localcontext() as ctx:
        ctx.prec=200
        return float(sum((Decimal.from_float(x)-Decimal.from_float(y))**2 for x,y in zip(a,b)).sqrt())

def rank(columns):
    # GF(2) elimination with sets, independent of F's packed words/pairing.
    basis={}
    for c in columns:
        c=set(c)
        while c:
            p=min(c)
            if p not in basis:
                basis[p]=c;break
            c ^= basis[p]
    return len(basis)

def betti(n, distances, cutoff):
    edges=[e for e,w in distances.items() if w<=cutoff]
    edge_set=set(edges)
    triangles=[t for t in it.combinations(range(n),3) if all(e in edge_set for e in it.combinations(t,2))]
    r1=rank(edges); r2=rank([tuple(it.combinations(t,2)) for t in triangles])
    return n-r1,len(edges)-r1-r2

def prim(n, distances):
    seen={0}; cost=Fraction(0)
    while len(seen)<n:
        w,i,j=min((w,i,j) for (i,j),w in distances.items() if (i in seen)!=(j in seen))
        seen.update((i,j));cost+=Fraction(w)
    return cost

def rho(x,y):
    pairs=list(it.combinations(range(len(x)),2))
    a=sum((Fraction(x[i])-Fraction(x[j]))**2 for i,j in pairs)
    b=sum((Fraction(y[i])-Fraction(y[j]))**2 for i,j in pairs)
    c=sum((Fraction(x[i])-Fraction(x[j]))*(Fraction(y[i])-Fraction(y[j])) for i,j in pairs)
    if not a or not b:return None
    with localcontext() as ctx:
        ctx.prec=200
        dec=lambda q:Decimal(q.numerator)/Decimal(q.denominator)
        return float(dec(c)/(dec(a)*dec(b)).sqrt())

class DiagnosticsTests(unittest.TestCase):
    def check_complex(self,points):
        s=support(points);b=counter();b.reserve_memory(37)
        r=analyze_aligned_support(s,budget=b);g=r['geometry']; n=len(s)
        distances={(i,j):distance(s[i][1],s[j][1]) for i,j in it.combinations(range(n),2)}
        self.assertEqual(g['pairwise_distances'],tuple(distances.values()))
        self.assertEqual(g['pair_order'],tuple(distances))
        self.assertEqual(sum(Fraction(e[2]) for e in g['forest']['edges']),prim(n,distances))
        self.assertEqual(g['forest']['components'],(tuple('state%03d'%i for i in range(n)),))
        for threshold in sorted({0.,*distances.values()}):
            counts=tuple(sum(dim==d and birth<=threshold and (death is None or threshold<death) for dim,birth,death,_ in g['bars']) for d in (0,1))
            self.assertEqual(counts,betti(n,distances,threshold),('threshold',threshold))
        x,y=zip(*(p[1][:2] for p in s));expected=rho(x,y)
        self.assertEqual(r['statistics']['first_two_features']['rho'],expected)
        self.assertIs(r['execution_authority'],False);self.assertIs(r['trading_authorized'],False)
        size=len(json.dumps(r,separators=(',',':'),allow_nan=False).encode())
        self.assertEqual(b.snapshot()['live_bytes'],37+size)
        b.release_memory(size);self.assertEqual(b.snapshot()['live_bytes'],37)
        return g
    def test_rectangular_grid(self):
        self.check_complex(tuple(it.product(range(3),range(2))))
    def test_cube_eight_state_boundary(self):
        g=self.check_complex(tuple(it.product((0,1),repeat=3)))
        self.assertEqual(len(g['pairwise_distances']),28)
    def test_duplicate_points_and_ties(self):
        self.check_complex(((0,0),(0,0),(1,0),(1,1),(0,1)))
    def test_nine_state_cap_statistics_remain(self):
        s=support(tuple((i, i*i) for i in range(9)))
        r=analyze_aligned_support(s,budget=counter())
        self.assertEqual(r['geometry'],{'status':'NOT_RUN','reason':'PAIRWISE_SUPPORT_LIMIT_8'})
        self.assertEqual(r['statistics']['first_two_features']['rho'],rho(*zip(*(row[1] for row in s))))
    def test_extreme_numeric_failure_preserves_actual_geometry_lease(self):
        b=counter(); lease=run_synthetic_geometry_v1(((1.,0.,0.,0.),(0.,1.,0.,0.)),(1000,2000),radius=1.,cadence_ms=1000,budget=b)
        before=b.snapshot()['live_bytes']
        with self.assertRaisesRegex(ValueError,'NUMERIC_OVERFLOW'):
            analyze_aligned_support(support(((1e308,0),(-1e308,1))),budget=b)
        self.assertEqual(b.snapshot()['live_bytes'],before)
        lease.release();self.assertEqual(b.snapshot()['live_bytes'],0)
    def test_32_feature_statistics_at_geometry_cap(self):
        s=support(tuple(tuple((i+1)*(j+1) for j in range(32)) for i in range(8)))
        b=counter(); r=analyze_aligned_support(s,budget=b)
        self.assertEqual(r['geometry']['status'],'COMPUTED')
        self.assertEqual(len(r['statistics']['adjacent_by_feature']),32)
        self.assertTrue(all(x['rho']==1.0 and x['exact_perfect'] for x in r['statistics']['adjacent_by_feature']))
        self.assertEqual(r['statistics']['first_two_features']['rho'],1.0)
        self.assertEqual(len(r['geometry']['forest']['edges']),7)

if __name__=='__main__':unittest.main()
