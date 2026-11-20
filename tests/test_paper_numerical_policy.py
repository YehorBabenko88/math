"""Literal hand-oracles for the existing paper engine's28HALF_EVEN policy."""
from decimal import Decimal as D,localcontext
import unittest
from market_math import (adverse_execution_price,paper_position_size,paper_entry_fee,paper_stop_price,paper_entry_side,paper_fill_metrics)

class PaperNumericalPolicyTests(unittest.TestCase):
 def test_literal_fill_fee_and_slippage_vectors_all_hostile_contexts(self):
  for precision in (1,2,7,28):
   with localcontext() as ctx:
    ctx.prec=precision;ctx.Emin=-2;ctx.Emax=2
    for signal in ctx.traps:ctx.traps[signal]=True
    self.assertEqual(paper_position_size(D(100),D(100)),D(1))
    self.assertEqual(paper_entry_fee(D(100),D('.001')),D('.1'))
    self.assertEqual(paper_fill_metrics('long',D(100),D(110),D(1),D('.1'),D('.001')),(D(10),D('.21'),D('9.79')))
    self.assertEqual(paper_fill_metrics('short',D(100),D(90),D(1),D('.1'),D('.001')),(D(10),D('.19'),D('9.81')))
    for side,entry,expected in [('long',True,'100.1'),('long',False,'99.9'),('short',True,'99.9'),('short',False,'100.1')]:
     self.assertEqual(adverse_execution_price(D(100),side,D(10),entry),D(expected))
    self.assertEqual(paper_stop_price(D('100.1'),'long',D('.05')),D('95.095'))
    self.assertEqual(paper_stop_price(D('100.1'),'short',D('.05')),D('105.105'))
    self.assertFalse(any(ctx.flags.values()))
 def test_entry_side_inclusive_boundaries_and_original_short_first_order(self):
  for price,expected in [('98.5','long'),('101.5','short'),('100',None)]:
   self.assertEqual(paper_entry_side(D(price),D(100),D('.015')),expected)
  self.assertEqual(paper_entry_side(D(100),D(100),D(0)),'short')
  self.assertEqual(paper_entry_side(D(100),D(100),D('1e-29')),'short')
 def test_repeating_ratios_and_sequential_rounding_are_fixed(self):
  self.assertEqual(paper_position_size(D(1),D(3)),D('0.3333333333333333333333333333'))
  # Net subtracts entryfee first thenexitfee, reproducing old28digit steps.
  result=paper_fill_metrics('long',D(1),D(2),D('1e28'),D(1),D('1e-28'))
  self.assertEqual(result,(D('1e28'),D(3),D('9999999999999999999999999997')))
  self.assertEqual(paper_fill_metrics('long',D(1),D(2),D('1e29'),D(6),D('3e-29')),(D('1e29'),D(12),D('9.999999999999999999999999998e28')))
 def test_legacy_unbounded_nonnegative_stop_policy_is_explicit(self):
  self.assertEqual(paper_stop_price(D(100),'long',D(1)),D(0))
  self.assertEqual(paper_stop_price(D(100),'long',D(2)),D(-100))
 def test_invalid_decimal_bool_side_and_domain_refuse_without_context_flags(self):
  for precision in (2,28):
   with localcontext() as ctx:
    ctx.prec=precision
    for signal in ctx.traps:ctx.traps[signal]=True
    for bad in (True,'1',1,D('NaN'),D('Infinity'),D(0),D(-1),D('1e4097'),D('1.'+'1'*128)):
     for call in (lambda:paper_position_size(bad,D(1)),lambda:paper_entry_fee(bad,D('.1')),lambda:paper_fill_metrics('long',bad,D(2),D(1),D(0),D('.1'))):
      with self.subTest(bad=bad),self.assertRaises(ValueError):call()
    for bad in (True,D(-1),D(1),D('NaN')):
     with self.assertRaises(ValueError):paper_entry_fee(D(1),bad)
    with self.assertRaises(ValueError):adverse_execution_price(D(1),'long',D(10000),True)
    with self.assertRaises(ValueError):adverse_execution_price(D(1),'long',D(1),1)
    with self.assertRaises(ValueError):paper_stop_price(D(1),'BUY',D('.1'))
    self.assertFalse(any(ctx.flags.values()))
 def test_derived_tiny_position_and_canonical_reexports(self):
  import market_compute_api as api
  self.assertIs(api.paper_fill_metrics,paper_fill_metrics)
  self.assertEqual(paper_position_size(D('1e-1000'),D('1e1000')),D('1e-2000'))

class PaperOutputDomainTests(unittest.TestCase):
 def test_derived_outputs_outside_supported_domain_refuse_before_controller_commit(self):
  for call in (lambda:paper_position_size(D('1e4096'),D('1e-4096')),lambda:paper_entry_fee(D('1e-4096'),D('1e-4096')),lambda:paper_stop_price(D('1e4096'),'short',D('1e4096')),lambda:paper_fill_metrics('long',D(1),D('1e4096'),D('1e4096'),D(0),D(0))):
   with self.assertRaises(ValueError):call()
 def test_old_rounded_slippage_fraction_one_is_rejected(self):
  with self.assertRaises(ValueError):adverse_execution_price(D(100),'short',D('9999.9999999999999999999999999'),True)
