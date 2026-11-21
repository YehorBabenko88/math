
"""Causal binary64 value-area kernels; original three roles plus strict domains."""
import dataclasses,hashlib,importlib.util,json,math,pathlib,sys,types,unittest
from decimal import Decimal,localcontext
ROOT=pathlib.Path(__file__).resolve().parents[1]
class ValueAreaTests(unittest.TestCase):
 def api(self):
  import market_math as m
  self.assertTrue(hasattr(m,'trade_value_area_metrics'),'canonical trade value-area kernel missing')
  self.assertTrue(hasattr(m,'candle_proxy_value_area_metrics'),'canonical candle proxy kernel missing')
  return m
 def trade(self,t,p,v,available=None):
  return dict(event_ms=t,available_at_ms=t if available is None else available,price=p,volume=v)
 def candle(self,start,high,low,close,volume,end=60,available=60):
  return dict(event_start_ms=start,event_end_ms=end,available_at_ms=available,high=high,low=low,close=close,volume=volume)
 def test_original_trade_profile_labels_executed_trade_basis(self):
  m=self.api();rows=[self.trade(1,100,2),self.trade(2,101,1),self.trade(3,100,3)]
  x=m.trade_value_area_metrics(rows,decision_ms=10)
  self.assertEqual(x.basis,'EXECUTED_TRADE_PRICE_BINS');self.assertEqual(x.poc,100);self.assertEqual(x.decision_ms,10)
  self.assertEqual(x.available_at_ms,3)
 def test_original_proxy_profile_is_explicitly_approximate(self):
  m=self.api();x=m.candle_proxy_value_area_metrics([self.candle(0,101,99,100,5)],decision_ms=60)
  self.assertEqual(x.basis,'CANDLE_TYPICAL_PRICE_PROXY')
  self.assertEqual((x.poc,x.value_area_high,x.value_area_low,x.value_area_width),(100.,100.,100.,0.))
 def test_original_future_trades_do_not_change_frozen_profile(self):
  m=self.api();base=[self.trade(1,100,5),self.trade(2,101,1)]
  self.assertEqual(m.trade_value_area_metrics(base,decision_ms=10),m.trade_value_area_metrics(base+[self.trade(11,200,100)],decision_ms=10))
 def test_poc_ties_lowest_while_ranked_70_percent_ties_keep_insertion(self):
  m=self.api();rows=[self.trade(i,p,1) for i,p in enumerate((104,103,102,101),1)]
  x=m.trade_value_area_metrics(rows,decision_ms=10)
  self.assertEqual((x.poc,x.value_area_low,x.value_area_high,x.value_area_width),(101,102,104,2))
 def test_exact_70_percent_threshold_stops_after_reaching_target(self):
  m=self.api();x=m.trade_value_area_metrics([self.trade(1,105,7),self.trade(2,100,3)],decision_ms=10)
  self.assertEqual((x.poc,x.value_area_low,x.value_area_high,x.value_area_width),(105,105,105,0))
 def test_all_zero_volume_preserves_lowest_poc_and_first_seen_value_area(self):
  m=self.api();x=m.trade_value_area_metrics([self.trade(1,102,0),self.trade(2,100,-0.)],decision_ms=10)
  self.assertEqual((x.poc,x.value_area_low,x.value_area_high),(100,102,102))
 def test_delayed_old_observation_never_borrows_event_time_availability(self):
  m=self.api();rows=[self.trade(1,100,10,available=100),self.trade(2,101,1,available=2)]
  early=m.trade_value_area_metrics(rows,decision_ms=10);late=m.trade_value_area_metrics(rows,decision_ms=100)
  self.assertEqual((early.poc,early.available_at_ms),(101,2));self.assertEqual((late.poc,late.available_at_ms),(100,100))
 def test_every_future_row_is_closed_and_validated(self):
  m=self.api();base=[self.trade(1,100,1)]
  for bad in (dict(event_ms=11,price=100,volume=1),dict(event_ms=11,available_at_ms=10,price=100,volume=1),self.trade(11,float('nan'),1),dict(self.trade(11,100,1),extra=1)):
   with self.assertRaises(ValueError):m.trade_value_area_metrics(base+[bad],decision_ms=10)
 def test_candle_requires_explicit_end_and_availability_no_duration_inference(self):
  m=self.api();valid=self.candle(0,101,99,100,5)
  for key in ('event_end_ms','available_at_ms'):
   bad=dict(valid);bad.pop(key)
   with self.assertRaises(ValueError):m.candle_proxy_value_area_metrics([bad],decision_ms=60)
  for end,available in ((0,60),(-1,60),(60,59),(True,60),(60,True)):
   with self.assertRaises(ValueError):m.candle_proxy_value_area_metrics([dict(valid,event_end_ms=end,available_at_ms=available)],decision_ms=60)
 def test_outer_and_row_cardinality_refuse_before_custom_iteration(self):
  m=self.api()
  class BadList(list):
   def __iter__(self):raise AssertionError('CUSTOM_ITERATION')
  class BadDict(dict):
   def __iter__(self):raise AssertionError('CUSTOM_ITERATION')
  for rows in (BadList(),[{}]*4097,(BadDict(),)):
   with self.assertRaises(ValueError):m.trade_value_area_metrics(rows,decision_ms=10)
  with self.assertRaises(ValueError):m.trade_value_area_metrics([dict(self.trade(1,100,1),**{str(i):i for i in range(10000)})],decision_ms=10)
 def test_no_old_schema_or_callable_aliases(self):
  m=self.api()
  for row in (dict(t=1,price=100,volume=1),dict(event_time=1,known_at=1,price=100,volume=1)):
   with self.assertRaises(ValueError):m.trade_value_area_metrics([row],decision_ms=10)
  self.assertFalse(hasattr(m,'trade_profile'));self.assertFalse(hasattr(m,'proxy_profile'))
 def test_numeric_literals_reject_coercion_subclasses_bool_and_nonfinite(self):
  m=self.api()
  class I(int):pass
  class Meta(type):
   def __eq__(self,other):raise AssertionError('METACLASS_EQ')
   def __hash__(self):raise AssertionError('METACLASS_HASH')
  class Bad(metaclass=Meta):pass
  for bad in (True,I(1),Bad(),Decimal(1),'1',float('nan'),float('inf'),-1):
   for field in ('price','volume'):
    row=self.trade(1,100,1);row[field]=bad
    with self.assertRaises(ValueError):m.trade_value_area_metrics([row],decision_ms=10)
 def test_lossy_integers_refused_but_original_representable_price_type_retained(self):
  m=self.api()
  for field in ('price','volume'):
   row=self.trade(1,100,1);row[field]=2**53+1
   with self.assertRaises(ValueError):m.trade_value_area_metrics([row],decision_ms=10)
  x=m.trade_value_area_metrics([self.trade(1,2**54,1),self.trade(2,1,0)],decision_ms=10)
  self.assertIs(type(x.poc),int);self.assertEqual(x.poc,2**54);self.assertIs(type(x.value_area_width),int)
 def test_candle_typical_price_overflow_refused_even_in_future(self):
  m=self.api();base=self.candle(0,101,99,100,5)
  bad=self.candle(60,1e308,1e308,1e308,1,end=120,available=120)
  with self.assertRaises(ValueError):m.candle_proxy_value_area_metrics([base,bad],decision_ms=60)
 def test_aggregate_or_total_overflow_refused_even_in_future(self):
  m=self.api()
  for rows in ([self.trade(1,100,1e308),self.trade(2,100,1e308)],[self.trade(1,100,1e308),self.trade(2,101,1e308)],[self.trade(1,100,1),self.trade(11,101,1e308),self.trade(12,101,1e308)]):
   with self.assertRaises(ValueError):m.trade_value_area_metrics(rows,decision_ms=10)
 def test_input_detached_and_result_is_frozen(self):
  m=self.api();row=self.trade(1,100,5);rows=[row];x=m.trade_value_area_metrics(rows,decision_ms=10)
  row['price']=999;rows.clear();self.assertEqual(x.poc,100)
  with self.assertRaises((AttributeError,TypeError)):x.poc=999
 def test_hostile_decimal_context_and_preexisting_flags_unchanged(self):
  m=self.api();rows=[self.trade(1,math.nextafter(1.,0.),1),self.trade(2,1.,1),self.trade(3,5e-324,1)]
  expected=m.trade_value_area_metrics(rows,decision_ms=10)
  for precision in (1,7,28):
   with localcontext() as context:
    context.prec=precision;context.Emax=2;context.Emin=-2
    for signal in context.traps:context.traps[signal]=True
    context.clear_flags();before=(dict(context.flags),dict(context.traps),context.prec,context.Emax,context.Emin)
    self.assertEqual(m.trade_value_area_metrics(rows,decision_ms=10),expected)
    self.assertEqual((dict(context.flags),dict(context.traps),context.prec,context.Emax,context.Emin),before)
 def test_existing_decimal_poc_is_reused_after_binary64_aggregation(self):
  m=self.api();actual=m.volume_profile_poc;calls=[]
  def record(profile,**options):calls.append(dict(profile));return actual(profile,**options)
  m.volume_profile_poc=record
  try:x=m.trade_value_area_metrics([self.trade(1,101,1),self.trade(2,100,1)],decision_ms=10)
  finally:m.volume_profile_poc=actual
  self.assertEqual(x.poc,100);self.assertTrue(calls)
  self.assertEqual(set(calls[-1]),{Decimal(100),Decimal(101)})
 def test_extreme_distinct_prices_do_not_collide_in_poc_selection(self):
  m=self.api();prices=[math.nextafter(1.,0.),1.,math.nextafter(1.,math.inf),5e-324,1e308,2**54]
  x=m.trade_value_area_metrics([self.trade(i,p,1) for i,p in enumerate(prices,1)],decision_ms=10)
  self.assertEqual(x.poc,5e-324)
  self.assertEqual((x.value_area_low,x.value_area_high),(5e-324,1e308))
 def test_full_4096_rows_remain_bounded_and_complete(self):
  m=self.api();x=m.trade_value_area_metrics([self.trade(i,i,1) for i in range(1,4097)],decision_ms=4096)
  self.assertEqual((x.poc,x.value_area_low,x.value_area_high,x.available_at_ms),(1,1,2868,4096))
 def test_literal_clock_domain_empty_and_no_eligible_refuse(self):
  m=self.api()
  for bad in (True,None,'10',10.,-1,253402300800000):
   with self.assertRaises(ValueError):m.trade_value_area_metrics([self.trade(1,100,1)],decision_ms=bad)
  for rows in ([],(),[self.trade(11,100,1)]):
   with self.assertRaises(ValueError):m.trade_value_area_metrics(rows,decision_ms=10)
  maximum=253402300799999
  x=m.trade_value_area_metrics([self.trade(maximum,100,1)],decision_ms=maximum)
  self.assertEqual(x.available_at_ms,maximum)
 def test_integer_float_same_price_preserves_first_literal_key_type(self):
  m=self.api();a=m.trade_value_area_metrics([self.trade(1,100,1),self.trade(2,100.,1)],decision_ms=10)
  b=m.trade_value_area_metrics([self.trade(1,100.,1),self.trade(2,100,1)],decision_ms=10)
  self.assertEqual(a.poc,b.poc);self.assertIs(type(a.poc),int);self.assertIs(type(b.poc),float)
