"""Independent literal query numeric contracts; no source or access authority."""
import unittest
from decimal import Decimal as D,localcontext
import market_math as m
class QueryNumericTests(unittest.TestCase):
 def grid(self,*args,**kwargs):return m.query_minute_grid_ms(*args,**kwargs)
 def test_literal_half_open_cells_and_cut(self):
  self.assertEqual(self.grid(0,120000),((0,60000),(60000,120000)))
  self.assertEqual(self.grid(60000,180000,event_cut_ms=180000),((60000,120000),(120000,180000)))
  self.assertEqual(self.grid(60000,120000,event_cut_ms=120001),((60000,120000),))
 def test_maximum_cells_and_utc_boundary(self):
  cells=self.grid(0,86400000);self.assertEqual(len(cells),1440);self.assertEqual(cells[0],(0,60000));self.assertEqual(cells[-1],(86340000,86400000))
  self.assertEqual(self.grid(253402300680000,253402300740000),((253402300680000,253402300740000),))
  for args in ((0,86460000),(0,0),(60000,0),(1,60000),(0,60001),(253402300740000,253402300800000)):
   with self.subTest(args=args),self.assertRaises(ValueError):self.grid(*args)
 def test_literal_types_reject_before_hostile_callbacks(self):
  class Hostile(int):
   def __int__(self):raise AssertionError('HOSTILE_COERCION')
   def __lt__(self,*a):raise AssertionError('HOSTILE_COMPARISON')
   def __mod__(self,*a):raise AssertionError('HOSTILE_ARITHMETIC')
  for bad in (True,False,None,'0',0.0,D(0),Hostile(0),-1,253402300800000,1<<100000):
   with self.subTest(role='start',badtype=type(bad).__name__),self.assertRaises(ValueError):self.grid(bad,60000)
   with self.subTest(role='end',badtype=type(bad).__name__),self.assertRaises(ValueError):self.grid(0,bad)
  for bad in (True,False,'60000',60000.0,D(60000),Hostile(60000),59999,-1,253402300800000,1<<100000):
   with self.subTest(role='cut',badtype=type(bad).__name__),self.assertRaises(ValueError):self.grid(0,60000,event_cut_ms=bad)
 def test_enumerated_small_grids(self):
  for start in (0,60000,120000,300000):
   for end in (60000,120000,180000,360000):
    if start>=end:continue
    expected=tuple((x,x+60000) for x in (0,60000,120000,180000,240000,300000) if start<=x<end)
    self.assertEqual(self.grid(start,end),expected)
 def test_old_ohlcv_call_and_exact_turnover(self):
  args=(D(10),D(11),D(9),D(10),D(0))
  self.assertTrue(m.candle_ohlcv_valid(*args))
  for turnover in (D(0),D('1.234567890123456789'),D('1e4096'),D('1e-4096')):
   with self.subTest(turnover=turnover):self.assertTrue(m.candle_ohlcv_turnover_valid(*args,turnover=turnover))
 def test_invalid_turnover_never_coerced_or_treated_as_omitted(self):
  args=(D(10),D(11),D(9),D(10),D(0))
  class Subclass(D):pass
  for turnover in (None,True,False,0,1.0,'1',Subclass('1'),D('-1'),D('NaN'),D('sNaN'),D('Infinity'),D('1e4097'),D('1e-4097'),D('1'*129)):
   with self.subTest(type=type(turnover).__name__):self.assertFalse(m.candle_ohlcv_turnover_valid(*args,turnover=turnover))
 def test_invalid_ohlcv_stays_invalid_with_turnover(self):
  for args in ((D(10),D(9),D(8),D(10),D(1)),(D(0),D(1),D(0),D(1),D(1)),(D(1),D(2),D(1),D(2),D(-1))):
   self.assertFalse(m.candle_ohlcv_valid(*args));self.assertFalse(m.candle_ohlcv_turnover_valid(*args,turnover=D(0)))
 def test_hostile_decimal_context_is_unchanged(self):
  with localcontext() as c:
   c.prec=1;c.Emin=-2;c.Emax=2
   for signal in c.traps:c.traps[signal]=True
   before=(c.prec,c.Emin,c.Emax,dict(c.traps),dict(c.flags))
   self.assertTrue(m.candle_ohlcv_turnover_valid(D('10.1'),D('11.2'),D('9.3'),D('10.4'),D(0),turnover=D('1e4096')))
   self.assertEqual(self.grid(0,120000),((0,60000),(60000,120000)))
   self.assertEqual(before,(c.prec,c.Emin,c.Emax,dict(c.traps),dict(c.flags)))

if __name__=='__main__':unittest.main()
