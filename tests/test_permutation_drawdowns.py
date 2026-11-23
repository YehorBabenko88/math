import math,random,unittest
from decimal import Decimal,localcontext
from unittest.mock import patch
import history_statistics as h
class PermutationDrawdownTests(unittest.TestCase):
 def api(self):
  self.assertTrue(hasattr(h,'permutation_drawdowns'),'permutation drawdown API absent')
  return h.permutation_drawdowns
 def test_exact_seed_order_matches_pinned_legacy(self):
  f=self.api()
  # Literal ordered binary64 oracle from the reviewed archived legacy function.
  def legacy(values,runs,seed):
   xs=list(float(x) for x in values);rng=random.Random(seed);out=[]
   for _ in range(runs):
    path=list(xs);rng.shuffle(path);equity=peak=dd=0.0
    for x in path:equity+=x;peak=max(peak,equity);dd=max(dd,peak-equity)
    out.append(dd)
   return tuple(out)
  for values in ((2,-1,3,-4,0,-1),(1e16,1,-1e16,-2),(0,),(5e-324,-5e-324),(1,2,3),(-1,-2,-3)):
   for seed in (0,17,2**31-1):
    with self.subTest(values=values,seed=seed):self.assertEqual(f(values,runs=31,seed=seed),legacy(values,31,seed))
 def test_hand_oracle_default_count_and_immutable_float_result(self):
  f=self.api();self.assertEqual(f((-2,),runs=3),(2.,2.,2.));self.assertEqual(f((1,0,2),runs=3),(0.,0.,0.));out=f((0,));self.assertIs(type(out),tuple);self.assertEqual(len(out),1000);self.assertTrue(all(type(x) is float for x in out))
 def test_global_random_state_and_inputs_unchanged(self):
  f=self.api();values=[2,-1,4,-3];before=values.copy();state=random.getstate();out=f(values,runs=17,seed=5);self.assertEqual(random.getstate(),state);self.assertEqual(values,before);self.assertEqual(out,f(values,runs=17,seed=5))
 def test_empty_and_policy_bounds_before_rng(self):
  f=self.api();calls=[]
  with patch.object(h.random,'Random',side_effect=lambda *a:calls.append(a)):
   for values,kwargs in (((),{}),((0,)*4097,{}),((0,)*4096,{'runs':245}),((1,),{'runs':0}),((1,),{'runs':1001}),((1,),{'runs':True}),((1,),{'runs':1.}),((1,),{'seed':-1}),((1,),{'seed':2**31}),((1,),{'seed':True}),((1,),{'seed':1.})):
    with self.subTest(kwargs=kwargs),self.assertRaises(ValueError):f(values,**kwargs)
  self.assertEqual(calls,[])
 def test_exact_workload_boundary(self):
  f=self.api();self.assertEqual(len(f((0,)*1000,runs=1000)),1000);self.assertEqual(len(f((0,)*4096,runs=244)),244)
 def test_literal_values_no_coercion_or_foreign_callbacks(self):
  f=self.api();calls=[]
  class Meta(type):
   def __eq__(self,other):calls.append('meta');raise AssertionError
  class Foreign(metaclass=Meta):
   def __float__(self):calls.append('float');raise AssertionError
   def __iter__(self):calls.append('iter');raise AssertionError
  class Float(float):
   def __float__(self):calls.append('float');raise AssertionError
  class Seq(list):
   def __iter__(self):calls.append('iter');raise AssertionError
  for values in (Foreign(),Seq([1]),iter((1,)),(Foreign(),),(Float(1),),(True,),(Decimal(1),),(2**53+1,),(float('nan'),),(float('inf'),)):
   with self.assertRaises(ValueError):f(values,runs=1)
  self.assertEqual(calls,[])
 def test_entire_batch_preflight_before_rng_or_equity(self):
  f=self.api();calls=[]
  with patch.object(h.random,'Random',side_effect=lambda *a:calls.append(a)),patch.object(h,'_ordered_equity_summary',side_effect=lambda *a:calls.append(a)):
   with self.assertRaises(ValueError):f((1,object()),runs=1)
  self.assertEqual(calls,[])
 def test_snapshot_before_first_admission(self):
  f=self.api();values=[2,-3,4,-1];original=h._screen_number
  def number(v):values.clear();return original(v)
  expected=f(tuple(values),runs=7)
  with patch.object(h,'_screen_number',side_effect=number):self.assertEqual(f(values,runs=7),expected)
 def test_snapshot_before_rng_constructor(self):
  f=self.api();values=[2,-3,4,-1];original=random.Random;expected=f(tuple(values),runs=7)
  def rng(seed):values.clear();return original(seed)
  with patch.object(h.random,'Random',side_effect=rng):self.assertEqual(f(values,runs=7),expected)
 def test_nonfinite_derived_equity_and_distance_refuse(self):
  f=self.api()
  for values in ((1e308,1e308),(-1e308,-1e308),(1e308,-1e308,-1e308)):
   with self.assertRaises(ValueError):f(values,runs=31)
 def test_no_profit_factor_domain_dependency(self):
  f=self.api()
  with self.assertRaises(ValueError):h.numeric_profit_loss_summary((1e308,-5e-324))
  out=f((1e308,-5e-324),runs=5);self.assertEqual(len(out),5);self.assertTrue(all(math.isfinite(x) for x in out))
 def test_late_overflow_never_returns_partial_batch(self):
  f=self.api()
  class RNG:
   def __init__(self):self.calls=0
   def shuffle(self,path):
    self.calls+=1;path[:]=[1e308,-1e308,1e308] if self.calls==1 else [1e308,1e308,-1e308]
  rng=RNG()
  with patch.object(h.random,'Random',return_value=rng),self.assertRaises(ValueError):f((1e308,-1e308,1e308),runs=2)
  self.assertEqual(rng.calls,2)
 def test_decimal_context_untouched(self):
  f=self.api()
  with localcontext() as context:
   context.prec=2
   for signal in context.traps:context.traps[signal]=True
   before=context.copy();f((1,-2,3,-1),runs=7);self.assertEqual(context.flags,before.flags);self.assertEqual(context.traps,before.traps)
 def test_profit_loss_uses_same_equity_kernel(self):
  self.api();original=h._ordered_equity_summary;calls=[]
  def kernel(values):calls.append(tuple(values));return original(values)
  with patch.object(h,'_ordered_equity_summary',side_effect=kernel):out=h.numeric_profit_loss_summary((2,-3,1))
  self.assertEqual(calls,[(2.,-3.,1.)]);self.assertEqual((out.max_drawdown,out.max_consecutive_losses),(3,1))
