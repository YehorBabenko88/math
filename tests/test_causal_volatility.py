"""Pure numeric vectors and causal prefix invariance; no provider/ledger/authority."""
import math,unittest
from decimal import Decimal,localcontext,Inexact
import market_math as m

def bar(t=0,**changes):
 return dict(event_start_ms=t,open=100,high=101,low=99,close=100,volume=100,turnover=10000,**changes)
class CausalVolatilityTests(unittest.TestCase):
 def call(self,rows,**kw):return m.causal_volatility_metrics(rows,window=kw.pop('window',2),percentile_lookback=kw.pop('percentile_lookback',10),bar_duration_ms=60,**kw)
 def test_constant_vector_retains_original_formulas_and_prior_percentile(self):
  out=self.call([bar(0),bar(60),bar(120)])
  self.assertEqual(len(out),2);first,second=out
  self.assertEqual(first[:2],(60,120));self.assertEqual(first[2],.02);self.assertEqual(first[3],0)
  self.assertAlmostEqual(first[4],math.log(101/99)/math.sqrt(4*math.log(2)))
  self.assertEqual(first[5:],(.02,1.0,1.0,.5,2));self.assertEqual(second[8:],(1.0,4))
 def test_future_bars_cannot_reclassify_prior_snapshot(self):
  rows=[bar(i*60) for i in range(4)];before=self.call(rows)
  future=dict(bar(240),high=150,low=50,close=140,volume=10000,turnover=1400000)
  self.assertEqual(self.call(rows+[future])[:len(before)],before)
 def test_invalid_plain_shape_and_numeric_domains_refuse(self):
  for value in (True,False,'100',Decimal(100),float('nan'),float('inf'),10**10000,-1,0):
   with self.subTest(value_type=type(value).__name__):
    row=dict(bar(),close=value)
    with self.assertRaises(ValueError):self.call([row,bar(60)])
  for rows in ([dict(bar(),unknown=1)],[dict(bar(),high=98)],[bar(60),bar(0)],[bar(0),bar(0)]):
   with self.assertRaises(ValueError):self.call(rows)
 def test_strict_budgets_and_utc_end_refuse(self):
  for kw in ({'window':True},{'window':1},{'window':4097},{'percentile_lookback':0},{'percentile_lookback':True}):
   with self.assertRaises(ValueError):self.call([],**kw)
  with self.assertRaises(ValueError):self.call([bar(253402300799999)])
  with self.assertRaises(ValueError):self.call([bar(i*60) for i in range(4097)])
 def test_no_input_mutation_no_decimal_context_effects(self):
  rows=[bar(0),bar(60)];before=[dict(row) for row in rows]
  with localcontext() as context:
   context.prec=3;context.traps[Inexact]=True;context.clear_flags();flags=dict(context.flags)
   out=self.call(rows);self.assertEqual(context.prec,3);self.assertEqual(context.flags,flags)
  self.assertEqual(rows,before);self.assertIsInstance(out,tuple);self.assertIsInstance(out[0],tuple)
 def test_nonfinite_derived_metric_refuses_not_infinite_receipt(self):
  row=dict(bar(),open=1.0,high=1e308,low=1e-308,close=1.0)
  with self.assertRaises(ValueError):self.call([row,dict(row,event_start_ms=60)])
 def test_hostile_numeric_subclass_does_not_run_coercion_or_equality(self):
  calls=[]
  class Meta(type):
   def __eq__(self,other):calls.append('eq');raise AssertionError('metaclass callback')
  class Evil(float,metaclass=Meta):
   def __float__(self):calls.append('float');raise AssertionError('coercion callback')
  with self.assertRaises(ValueError):self.call([dict(bar(),close=Evil(100)),bar(60)])
  self.assertEqual(calls,[])
 def test_empty_short_prefix_validated_without_synthetic_output(self):
  self.assertEqual(self.call([]),());self.assertEqual(self.call([bar()]),())
