"""Plain historical OHLC/directional-volume domain, never provenance authority."""
import math,random,unittest
from decimal import Decimal,getcontext
from unittest.mock import patch
import market_math as owner

class HistoricalOhlcDirectionalVolumeTests(unittest.TestCase):
 def api(self):
  value=getattr(owner,'historical_ohlc_directional_volume_valid',None)
  self.assertTrue(callable(value),'PUBLIC_HISTORICAL_OHLC_DIRECTIONAL_VOLUME_PREDICATE_REQUIRED');return value
 def test_valid_equal_subnormal_huge_finite_and_integer_domains(self):
  f=self.api();tiny=5e-324;huge=float.fromhex('0x1.fffffffffffffp+1023')
  for values in ((1,2,1,2,0,0),(1.,1.,1.,1.,-0.,0.),(tiny,tiny,tiny,tiny,tiny,0.),(huge,huge,huge,huge,huge,huge),(10**308,10**308,10**308,10**308,10**308,0)):
   with self.subTest(values=values):self.assertIs(f(*values),True)
 def test_invalid_prices_order_sign_and_nonfinite_all_positions(self):
  f=self.api();base=[1.,2.,1.,2.,3.,0.]
  for i in range(6):
   for value in (True,False,None,'1',Decimal(1),float('nan'),float('inf'),float('-inf'),10**10000,-1.,-5e-324):
    values=base.copy();values[i]=value
    with self.subTest(index=i,kind=type(value).__name__):self.assertIs(f(*values),False)
  for i in range(4):
   for value in (0.,-0.):
    values=base.copy();values[i]=value
    with self.subTest(index=i,value=value):self.assertIs(f(*values),False)
  for values in ((3,2,1,1,0,0),(1,2,3,1,0,0),(1,2,1,3,0,0)):
   self.assertIs(f(*values),False)
 def test_foreign_subclasses_and_metaclasses_never_callback(self):
  f=self.api();calls=[]
  class Meta(type):
   def __eq__(self,other):calls.append('meta');return False
  class Foreign(metaclass=Meta):
   def __float__(self):calls.append('float');raise AssertionError
   def __le__(self,other):calls.append('le');raise AssertionError
  class Integer(int):
   def __float__(self):calls.append('float-int');raise AssertionError
  class Float(float):
   def __le__(self,other):calls.append('float-le');raise AssertionError
  for index in range(6):
   for value in (Foreign(),Integer(1),Float(1)):
    values=[1,1,1,1,0,0];values[index]=value;self.assertIs(f(*values),False)
  self.assertEqual(calls,[])
 def test_original_export_acceptance_grid_is_exact(self):
  f=self.api();choices=(5e-324,1.,2.,float.fromhex('0x1.fffffffffffffp+1023'))
  for o in choices:
   for h in choices:
    for l in choices:
     for c in choices:
      for buy,sell in ((0.,-0.),(1.,2.),(-5e-324,0.)):
       expected=all(type(v) is int or type(v) is float for v in (o,h,l,c,buy,sell)) and all(math.isfinite(v) for v in (o,h,l,c,buy,sell)) and 0<l<=min(o,c)<=max(o,c)<=h and min(buy,sell)>=0
       self.assertIs(f(o,h,l,c,buy,sell),bool(expected))
 def test_existing_aggregate_reuses_common_predicate_only(self):
  f=self.api();row=dict(open=1.,high=1.,low=1.,close=1.,buy_volume=1.,sell_volume=0.,delta=1.,trade_count=1,poc_price=1.,levels=[dict(price=1.,buy_volume=1.,sell_volume=0.,delta=1.,volume=1.,buy_count=1,sell_count=0)])
  self.assertIs(owner.historical_aggregate_integrity(row),True);calls=[]
  def deny(*values):calls.append(values);return False
  with patch.object(owner,'historical_ohlc_directional_volume_valid',side_effect=deny):self.assertIs(owner.historical_aggregate_integrity(row),False)
  self.assertEqual(calls,[(1.,1.,1.,1.,1.,0.)]);self.assertIs(f(1.,1.,1.,1.,1.,0.),True)
 def test_decimal_context_rng_and_inputs_are_unchanged(self):
  f=self.api();context=getcontext().copy();state=random.getstate();values=(1,2.,1.,2,3.,-0.);before=values
  self.assertIs(f(*values),True);self.assertEqual(values,before);self.assertEqual(random.getstate(),state)
  now=getcontext();self.assertEqual((now.prec,now.Emax,now.Emin,now.flags,now.traps),(context.prec,context.Emax,context.Emin,context.flags,context.traps))
