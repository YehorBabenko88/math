"""Numerical swing/gap primitives; no clocks, strategies or source authority."""
import unittest
from decimal import Decimal,localcontext
import market_math as kernels
class PriceStructurePatternsTests(unittest.TestCase):
 def api(self):
  self.assertTrue(hasattr(kernels,'price_structure_patterns'),'Math price structure API missing')
  return kernels.price_structure_patterns
 def test_original_strict_high_swing_and_full_confirmation_window(self):
  x,=self.api()(((1,0),(3,1),(2,1)),left=1,right=1)
  self.assertEqual(tuple(x),(1,0,3,3,0,3))
 def test_original_low_swing_and_two_sided_extreme(self):
  out=self.api()(((10,5),(15,1),(10,5)),left=1,right=1)
  self.assertEqual(tuple(map(tuple,out)),((1,0,15,15,0,3),(1,1,1,1,0,3)))
 def test_equal_neighbor_does_not_confirm_swing(self):self.assertEqual(self.api()(((3,1),(3,1),(2,1)),left=1,right=1),())
 def test_original_upward_gap_bounds_and_three_row_dependency(self):
  x,=self.api()(((10,8),(12,10),(15,13)),left=1,right=1)
  self.assertEqual(tuple(x),(2,2,10,13,0,3))
 def test_original_downward_gap_bounds(self):
  x,=self.api()(((15,13),(12,10),(10,8)),left=1,right=1)
  self.assertEqual(tuple(x),(2,3,10,13,0,3))
 def test_touching_gap_boundaries_do_not_emit(self):self.assertEqual(self.api()(((10,8),(11,9),(12,10)),left=1,right=1),())
 def test_literal_finite_lossless_ranges_required_without_callbacks(self):
  class F(float):
   def __float__(self):raise AssertionError('FOREIGN_CONVERSION')
  for bad in (True,F(1),Decimal('1'),'1',float('nan'),float('inf'),2**53+1,2**1024):
   with self.assertRaises(ValueError):self.api()(((2,1),(3,bad)),left=1,right=1)
  with self.assertRaises(ValueError):self.api()(((1,2),),left=1,right=1)
  with self.assertRaises(ValueError):self.api()(((1,-1),),left=1,right=1)
 def test_full_batch_preflight_including_unconfirmed_tail(self):
  with self.assertRaises(ValueError):self.api()(((1,0),(3,1),(2,1),(float('nan'),0)),left=1,right=1)
 def test_literal_container_shape_and_budget(self):
  class Rows(list):
   def __iter__(self):raise AssertionError('FOREIGN_ITERATION')
  for rows in (Rows([(1,0)]),{},((1,),),((1,0,2),),[(1,0)]*4097):
   with self.assertRaises(ValueError):self.api()(rows,left=1,right=1)
 def test_positive_bounded_literal_confirmation_widths(self):
  for value in (True,0,-1,65,1.0,'1'):
   for name in ('left','right'):
    with self.assertRaises(ValueError):self.api()((),**{name:value})
  self.assertEqual(self.api()((),left=64,right=64),())
 def test_decimal_context_and_input_values_unchanged(self):
  rows=((1.,0.),(3.,1.),(2.,1.))
  with localcontext() as c:
   c.prec=2
   for flag in c.flags:c.flags[flag]=True;c.traps[flag]=True
   before=(dict(c.flags),dict(c.traps))
   x,=self.api()(rows,left=1,right=1)
   self.assertIs(type(x.high),float);self.assertEqual((dict(c.flags),dict(c.traps)),before)
  self.assertEqual(rows,((1.,0.),(3.,1.),(2.,1.)))
 def test_result_is_immutable_and_short_valid_input_emits_nothing(self):
  self.assertEqual(self.api()(((1,0),),left=1,right=1),())
  x,=self.api()(((1,0),(3,1),(2,1)),left=1,right=1)
  with self.assertRaises(AttributeError):x.high=0
