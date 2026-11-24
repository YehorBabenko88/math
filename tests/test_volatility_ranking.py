"""Exact full-universe ranking; Data owns age/status selection."""
from decimal import Decimal as D,localcontext,Inexact
from fractions import Fraction
import unittest
import market_math

def row(symbol,last='2',prev='1',turn='1000000'):
 return dict(symbol=symbol,lastPrice=last,prevPrice24h=prev,turnover24h=turn)
class VolatilityRankingTests(unittest.TestCase):
 def rank(self,*args,**kwargs):
  self.assertTrue(hasattr(market_math,'rank_volatile_symbols'),'missing public ranking kernel')
  return market_math.rank_volatile_symbols(*args,**kwargs)
 def test_literal_formula_turnover_symbol_ties_and_entire_universe(self):
  rows=[row('AUSDT','3'),row('ZUSDT','2'),row('BUSDT','2',turn='2000000'),row('YUSDT','2'),row('LOWUSDT',turn='999999'),row('ZEROUSDT','0')]
  self.assertEqual(self.rank(rows),('AUSDT','BUSDT','ZUSDT','YUSDT'))
  self.assertEqual(len(self.rank([row('S'+str(i)+'USDT') for i in range(21)])),21)
 def test_fraction_oracle_and_tiny_differences_under_hostile_contexts(self):
  rows=[row('AUSDT','1.00000000000000000000000000002'),row('ZUSDT','1.00000000000000000000000000001'),row('NEGUSDT','.5'),row('ODDUSDT','1','3'),row('WIDEUSDT','1e4096','1e-4096')]
  oracle=tuple(r['symbol'] for r in sorted(rows,key=lambda r:(abs(Fraction(r['lastPrice'])/Fraction(r['prevPrice24h'])-1),Fraction(r['turnover24h']),r['symbol']),reverse=True))
  for precision in (1,2,3,5,28):
   with localcontext() as c:
    c.prec=precision;c.Emin=-2;c.Emax=2
    for signal in c.traps:c.traps[signal]=True
    c.flags[Inexact]=True;before=dict(c.flags)
    self.assertEqual(self.rank(rows),oracle);self.assertEqual(dict(c.flags),before)
 def test_invalid_refresh_refuses_without_mutating_input(self):
  import copy
  for bad in [row('AUSDT',True),row('AUSDT','NaN'),row('AUSDT','sNaN'),row('AUSDT','Infinity'),row('AUSDT','1e4097'),row('AUSDT','1e-4097'),row('AUSDT','1'*129),row('badUSDT'),row('A_USDT'),row('AUSDT',1.0),row('AUSDT',' 1'),row('AUSDT','1_0'),row('AUSDT','1e'+'9'*250)]:
   rows=[row('GOODUSDT'),bad];before=copy.deepcopy(rows)
   with self.assertRaises(ValueError):self.rank(rows)
   self.assertEqual(rows,before)
  for rows in ([row('AUSDT'),row('AUSDT')],[{**row('AUSDT'),'extra':0}], [dict(symbol='AUSDT')]):
   with self.assertRaises(ValueError):self.rank(rows)
 def test_numeric_ineligibility_is_not_malformed_and_minimum_exact(self):
  self.assertEqual(self.rank([row('NEGUSDT','-1'),row('ZEROUSDT',prev='0'),row('NEGTURNUSDT',turn='-1')]),())
  self.assertEqual(self.rank([row('AUSDT',turn='0')],min_turnover=D(0)),('AUSDT',))
  for bad in (True,1,1.0,'1',D('-1'),D('NaN')):
   with self.assertRaises(ValueError):self.rank([],min_turnover=bad)
 def test_caps_precede_iteration_and_number_allocation(self):
  class List(list):
   def __iter__(self):raise AssertionError('ITERATED_SUBCLASS')
  for bad in (List(),[row('AUSDT')]*4097,[dict.fromkeys(range(10000),0)]):
   with self.assertRaises(ValueError):self.rank(bad)
  with self.assertRaises(ValueError):self.rank([row('AUSDT','0'*257)])
  self.assertEqual(len(self.rank([row('S'+str(i)+'USDT') for i in range(4096)])),4096)
 def test_public_identity_and_no_rpc_strategy_expansion(self):
  import market_compute_api as api
  self.assertIs(getattr(market_math,'rank_volatile_symbols',None),getattr(api,'rank_volatile_symbols','MISSING'))
  self.assertEqual(api.MARKET_RANKING_NUMERIC_CAPABILITIES,frozenset({'rank_volatile_symbols'}))
  self.assertNotIn('rank_volatile_symbols',api.ALGORITHMS)
if __name__=='__main__':unittest.main()
