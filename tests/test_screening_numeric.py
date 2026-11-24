import json,math,random,sys,unittest
from decimal import Decimal
import history_statistics as h
GOLDENS=json.loads("{\"311\":[{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[0.375,0.625,1]},{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[-0.5125,0.625,1.5]},{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[0.375,0.625,0.875]},{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[-0.2749999999999998,0.625,1.4125000000000005]},{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[0.25,0.625,1.25]},{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[-0.5499999999999996,0.625,1.75]},{\"values\":[0],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[0,0,0]},{\"values\":[0],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[0,0,0]},{\"values\":[0],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[0,0,0]},{\"values\":[0],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[0,0,0]},{\"values\":[0],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[0,0,0]},{\"values\":[0],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[0,0,0]},{\"values\":[1,1,1],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[1,1,1]},{\"values\":[1,1,1],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[1,1,1]},{\"values\":[1,1,1],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[1,1,1]},{\"values\":[1,1,1],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[1,1,1]},{\"values\":[1,1,1],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[1,1,1]},{\"values\":[1,1,1],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[1,1,1]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[-2.3333333333333335,-2,-1.6666666666666667]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[-3,-2,-1.3333333333333333]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[-2.3333333333333335,-2,-1.6666666666666667]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[-3,-2,-1.3333333333333333]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[-2.3333333333333335,-2,-1.6666666666666667]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[-2.6999999999999997,-2,-1]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[-249999999998.5625,0.6875,250000000001.4375]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[-749999999999.3312,0.6875,750000000000.75]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[-249999999998.5625,0.6875,249999999999.9375]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[-524999999999.9248,0.6875,750000000000.75]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[-249999999999.25,0.6875,250000000000.625]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[-550000000000.112,0.6875,525000000001.42535]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[0,0.05000000000000002,0.175]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[-0.13499999999999993,0.05000000000000002,0.25]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[-6.938893903907228e-18,0.05000000000000002,0.15]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[-0.275,0.05000000000000002,0.25]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[-0.1,0.05000000000000002,0.2]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[-0.25250000000000006,0.05000000000000002,0.25250000000000006]}],\"312\":[{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[0.375,0.625,1]},{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[-0.5125,0.625,1.5]},{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[0.375,0.625,0.875]},{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[-0.2749999999999998,0.625,1.4125000000000005]},{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[0.25,0.625,1.25]},{\"values\":[1,-1,2,0.5],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[-0.5499999999999996,0.625,1.75]},{\"values\":[0],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[0,0,0]},{\"values\":[0],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[0,0,0]},{\"values\":[0],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[0,0,0]},{\"values\":[0],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[0,0,0]},{\"values\":[0],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[0,0,0]},{\"values\":[0],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[0,0,0]},{\"values\":[1,1,1],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[1,1,1]},{\"values\":[1,1,1],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[1,1,1]},{\"values\":[1,1,1],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[1,1,1]},{\"values\":[1,1,1],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[1,1,1]},{\"values\":[1,1,1],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[1,1,1]},{\"values\":[1,1,1],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[1,1,1]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[-2.3333333333333335,-2,-1.6666666666666667]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[-3,-2,-1.3333333333333333]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[-2.3333333333333335,-2,-1.6666666666666667]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[-3,-2,-1.3333333333333333]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[-2.3333333333333335,-2,-1.6666666666666667]},{\"values\":[-3,-2,-1],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[-2.6999999999999997,-2,-1]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[-249999999998.5625,0.6875,250000000001.4375]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[-749999999999.3312,0.6875,750000000000.75]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[-249999999998.5625,0.6875,249999999999.9375]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[-524999999999.9248,0.6875,750000000000.75]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[-249999999999.25,0.6875,250000000000.625]},{\"values\":[1000000000000,-1000000000000,3,-0.25],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[-550000000000.112,0.6875,525000000001.42535]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":0,\"confidence\":0.5,\"expected\":[0,0.049999999999999996,0.175]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":0,\"confidence\":0.95,\"expected\":[-0.13499999999999993,0.049999999999999996,0.25]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":7,\"confidence\":0.5,\"expected\":[0,0.049999999999999996,0.15]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":7,\"confidence\":0.95,\"expected\":[-0.275,0.049999999999999996,0.25]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":17,\"confidence\":0.5,\"expected\":[-0.1,0.049999999999999996,0.2]},{\"values\":[0.1,0.2,0.3,-0.4],\"runs\":37,\"seed\":17,\"confidence\":0.95,\"expected\":[-0.2525,0.049999999999999996,0.25250000000000006]}]}")
class ScreeningNumericTests(unittest.TestCase):
 def api(self,name):
  value=getattr(h,name,None);self.assertTrue(callable(value),'missing numerical contract '+name);return value
 def sample(self,x):return self.api('numeric_sample_summary')(x)
 def row(self,n,e,p):return self.api('NumericFoldObservation')(n,e,self.api('ProfitFactorObservation')('FINITE',p))
 def folds(self,rows,**kwargs):return self.api('numeric_fold_summary')(rows,**kwargs)
 def boot(self,x,**kwargs):return self.api('iid_observation_mean_bootstrap')(x,**kwargs)
 def test_explicit_stable_abi_and_cancellation(self):
  self.assertEqual(getattr(h,'SCREENING_NUMERIC_ABI',None),'math.numeric.screening.ordered-binary64.v1');self.assertEqual(self.sample([1e16,1.,-1e16]).total,0.)
 def test_sample_signed_counts_and_ordered_mean(self):
  r=self.sample((2.,-1.,0.,3.));self.assertEqual(tuple(r),(4,2,1,4.,1.,.5))
 def test_sample_empty_is_explicit_zero(self):self.assertEqual(tuple(self.sample(())),(0,0,0,0.,0.,0.))
 def test_sample_literal_numbers_only(self):
  class Hostile(float):
   def __float__(self):raise AssertionError('callback')
  for x in (True,'1',Decimal('1'),None,object(),Hostile(1),float('nan'),float('inf'),-float('inf')):
   with self.subTest(value=type(x)),self.assertRaises(ValueError):self.sample((x,))
 def test_sample_exact_sequence_and_bounds(self):
  class Foreign(list):pass
  for x in (iter([1]),Foreign([1]),{},'1',tuple([1.]*4097)):
   with self.assertRaises(ValueError):self.sample(x)
  self.assertEqual(self.sample([1.]*4096).count,4096)
 def test_sample_lossy_integer_refuses(self):
  with self.assertRaises(ValueError):self.sample((2**53+1,))
  self.assertEqual(self.sample((2**53,)).mean,float(2**53))
 def test_sample_nonfinite_result_refuses(self):
  with self.assertRaises(ValueError):self.sample((1e308,1e308))
 def test_sample_output_immutable_detached(self):
  values=[1.,2.];r=self.sample(values);values[0]=999.;self.assertEqual(r.mean,1.5)
  with self.assertRaises(AttributeError):r.mean=0
 def test_fold_default_threshold_equality_and_counts(self):
  r=self.folds((self.row(20,0.,1.05),self.row(20,.1,1.05),self.row(20,-.1,1.2)))
  self.assertEqual((r.folds,r.samples,r.profitable,r.losing),(3,60,1,1));self.assertTrue(hasattr(r,'profitable_fraction'),'missing Math fold ratios');self.assertEqual((r.profitable_fraction,r.losing_fraction),(1/3,1/3))
 def test_fold_unweighted_not_pooled(self):
  r=self.folds((self.row(1,10.,2.),self.row(100,0.,1.)));self.assertEqual(r.mean_expectancy,5.);self.assertEqual((r.profitable_fraction,r.losing_fraction),(.5,0.))
 def test_fold_explicit_thresholds_are_numeric_only(self):
  r=self.folds((self.row(1,-1.,.8),),min_expectancy=-2.,min_profit_factor=.8)
  self.assertEqual((r.profitable,r.losing),(1,1))
  for kw in ({'min_expectancy':True},{'min_profit_factor':float('inf')},{'min_profit_factor':-1.}):
   with self.assertRaises(ValueError):self.folds((),**kw)
 def test_fold_factor_cutoff_requires_named_policy(self):
  rows=(self.row(1,1.,1e100),self.row(1,1.,2.))
  self.assertEqual(self.folds(rows).eligible_factors,2)
  r=self.folds(rows,factor_policy='LEGACY_LT_1E100_V1');self.assertEqual((r.mean_profit_factor,r.eligible_factors,r.excluded_factors),(2.,1,1))
 def test_fold_no_losses_tag_never_becomes_zero(self):
  row=self.api('NumericFoldObservation')(4,2.,self.api('ProfitFactorObservation')('NO_LOSSES',None));r=self.folds((row,))
  self.assertIsNone(r.mean_profit_factor);self.assertEqual((r.no_loss_factors,r.profitable,r.losing),(1,1,0))
 def test_fold_empty_has_no_factor_mean(self):
  r=self.folds(());self.assertEqual((r.folds,r.samples,r.mean_expectancy),(0,0,0.));self.assertIsNone(r.mean_profit_factor);self.assertEqual((r.profitable_fraction,r.losing_fraction),(0.,0.))
 def test_fold_exact_rows_tags_and_policy_only(self):
  for row in ({'samples':1},self.api('NumericFoldObservation')(1,1.,self.api('ProfitFactorObservation')('FINITE',float('inf'))),self.api('NumericFoldObservation')(1,1.,self.api('ProfitFactorObservation')('NO_LOSSES',0)),self.api('NumericFoldObservation')(1,1.,self.api('ProfitFactorObservation')('ALIEN',None))):
   with self.assertRaises(ValueError):self.folds((row,))
  with self.assertRaises(ValueError):self.folds((),factor_policy='legacy')
 def test_fold_count_and_sample_budgets(self):
  for rows in ((self.row(True,1.,2.),),(self.row(-1,1.,2.),),(self.row(4096,1.,2.),self.row(1,1.,2.)),tuple(self.row(1,1.,2.) for _ in range(129))):
   with self.assertRaises(ValueError):self.folds(rows)
  self.assertEqual(self.folds(tuple(self.row(1,1.,2.) for _ in range(128))).folds,128)
 def test_fold_sum_overflow_refuses(self):
  with self.assertRaises(ValueError):self.folds((self.row(1,1e308,1.),self.row(1,1e308,1.)))
 def test_iid_matches_raw_legacy_seeded_linear_quantiles(self):
  key='311' # Explicit ORDERED_BINARY64_V1, independent of host sum implementation.
  for case in GOLDENS[key]:
   r=self.boot(case['values'],runs=case['runs'],seed=case['seed'],confidence=case['confidence']);self.assertEqual(tuple(r),tuple(case['expected']),case)
 def test_iid_repeated_draw_order_deterministic(self):
  self.assertEqual(self.boot([1.,2.,-1.],runs=37,seed=17),self.boot([1.,2.,-1.],runs=37,seed=17))
  with self.subTest(original_id='tests/research/test_validation_resampling.py::test_bootstrap_expectancy_is_seeded_and_contains_sample_mean'):
   values=(1.,-1.,2.,.5);first=self.boot(values,runs=200,seed=7,confidence=.95);second=self.boot(values,runs=200,seed=7,confidence=.95)
   self.assertEqual(first,second);self.assertEqual(first.mean,.625)
   self.assertLessEqual(first.lower,.625);self.assertLessEqual(.625,first.upper)
 def test_iid_never_mutates_ambient_rng(self):
  state=random.getstate();self.boot([1.,2.],runs=10);self.assertEqual(random.getstate(),state)
 def test_iid_closed_budgets(self):
  for kw in ({'runs':True},{'runs':0},{'runs':1001},{'seed':True},{'seed':-1},{'seed':2**31},{'confidence':True},{'confidence':0.},{'confidence':1.},{'confidence':float('nan')}):
   with self.assertRaises(ValueError):self.boot([1.],**kw)
  with self.assertRaises(ValueError):self.boot([])
  with self.assertRaises(ValueError):self.boot([1.]*1001,runs=1000)
 def test_iid_exact_work_limit_and_singleton(self):
  self.assertEqual(tuple(self.boot([2.],runs=1)),(2.,2.,2.));self.assertEqual(self.boot([1.]*1000,runs=1000).mean,1.)
 def test_iid_nonfinite_mean_or_quantile_refuses(self):
  for values in ([1e308,1e308],[float('nan')],[True]):
   with self.assertRaises(ValueError):self.boot(values,runs=1)
 def test_executed_notional_consistency_literal_matrix_and_context(self):
  import market_math as m
  from decimal import localcontext
  fn=getattr(m,'executed_notional_consistent',None);self.assertTrue(callable(fn),'missing executed notional consistency')
  for a,b,want in [(0,0,True),(0.,-0.,True),(1,1.,True),(5.,10,True),(0,5,False),(5,0,False),(-1,1,False),(1,-1,False),(2**53+1,1,False),(float('nan'),1,False),(1,float('inf'),False),(True,1,False),('1',1,False),(Decimal('1'),1,False)]:
   with self.subTest(a=repr(a),b=repr(b)):self.assertIs(fn(a,b),want)
  class ForeignDecimal(Decimal):
   def __eq__(self,other):raise AssertionError('decimal callback')
  class ForeignFloat(float):
   def __float__(self):raise AssertionError('float callback')
  self.assertIs(fn(ForeignDecimal('1'),Decimal('1')),False);self.assertIs(fn(ForeignFloat(1),1),False)
  for precision in (2,5,28):
   with localcontext() as ctx:
    ctx.prec=precision
    for signal in ctx.traps:ctx.traps[signal]=True
    ctx.clear_flags();before=dict(ctx.flags)
    for a,b,want in [('0','-0',True),('1E+999999','1E-999999',True),('5','0',False),('0','5',False),('-1','1',False),('sNaN','1',False),('NaN','1',False),('Infinity','1',False)]:self.assertIs(fn(Decimal(a),Decimal(b)),want)
    self.assertEqual(dict(ctx.flags),before)
 def test_foreign_metaclass_never_runs_through_public_numeric_or_batch_admission(self):
  import market_math as m
  calls=[]
  class HostileMeta(type):
   def __eq__(cls,other):calls.append('eq');raise AssertionError('foreign metaclass callback')
   def __ne__(cls,other):calls.append('ne');raise AssertionError('foreign metaclass callback')
  class Foreign(metaclass=HostileMeta):pass
  bad=Foreign()
  cases=(('sample_batch',lambda:self.sample(bad)),('sample_number',lambda:self.sample((bad,))),('fold_batch',lambda:self.folds(bad)),('fold_expectancy',lambda:self.folds((self.api('NumericFoldObservation')(1,bad,self.api('ProfitFactorObservation')('FINITE',1.)),))),('fold_factor',lambda:self.folds((self.api('NumericFoldObservation')(1,1.,self.api('ProfitFactorObservation')('FINITE',bad)),))),('fold_threshold',lambda:self.folds((),min_expectancy=bad)),('fold_factor_threshold',lambda:self.folds((),min_profit_factor=bad)),('iid_batch',lambda:self.boot(bad)),('iid_number',lambda:self.boot((bad,))),('iid_confidence',lambda:self.boot((1.,),confidence=bad)))
  for name,call in cases:
   with self.subTest(case=name),self.assertRaises(ValueError):call()
  for name,values in [('notional_turnover',(bad,1)),('notional_volume',(1,bad))]:
   with self.subTest(case=name):self.assertIs(m.executed_notional_consistent(*values),False)
  class EvilCount:
   def __truediv__(self,other):raise AssertionError('foreign division callback')
   def __rtruediv__(self,other):raise AssertionError('foreign reverse division callback')
   def __lt__(self,other):raise AssertionError('foreign count comparison callback')
   def __le__(self,other):raise AssertionError('foreign count comparison callback')
  summary=self.api('NumericFoldSummary')
  for property_name in ('profitable_fraction','losing_fraction'):
   getter=getattr(summary,property_name).fget
   for label,record in [('foreign_self',bad),('foreign_folds',summary(EvilCount(),0,0,0,0.,None,0,0,0)),('foreign_profit',summary(1,0,EvilCount(),0,0.,None,0,0,0)),('foreign_loss',summary(1,0,0,EvilCount(),0.,None,0,0,0)),('bool_folds',summary(True,0,0,0,0.,None,0,0,0)),('bool_profit',summary(1,0,True,0,0.,None,0,0,0)),('bool_loss',summary(1,0,0,True,0.,None,0,0,0)),('negative_folds',summary(-1,0,0,0,0.,None,0,0,0)),('too_many_folds',summary(129,0,0,0,0.,None,0,0,0)),('profit_exceeds',summary(1,0,2,0,0.,None,0,0,0)),('loss_exceeds',summary(1,0,0,2,0.,None,0,0,0)),('negative_profit',summary(1,0,-1,0,0.,None,0,0,0)),('negative_loss',summary(1,0,0,-1,0.,None,0,0,0))]:
    with self.subTest(property=property_name,case=label),self.assertRaises(ValueError):getter(record)
  self.assertEqual(calls,[])
if __name__=='__main__':unittest.main()
