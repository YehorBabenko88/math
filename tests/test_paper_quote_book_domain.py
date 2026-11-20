"""Independent Decimal quote-domain predicates; no quote/source authority."""
from decimal import Decimal as D,localcontext,Inexact,Rounded
import hashlib,importlib.util,pathlib,unittest
from market_math import paper_quote_book_valid
class QuoteBookDomainTests(unittest.TestCase):
 def test_literal_positive_locked_crossed_and_exact_narrow_books(self):
  for bid,ask,expected in [('1e-12','1e-12',True),('1e12','1e12',True),('10000000000.0000000001','10000000000.0000000002',True),('10000000000.0000000002','10000000000.0000000001',False),('0.000000000000999999999999','1',False),('1','1000000000000.000000000000001',False),('-0','1',False),('0','1',False)]:
   result=paper_quote_book_valid(D(bid),D(ask));self.assertIs(type(result),bool);self.assertIs(result,expected)
 def test_strict_types_nonfinite_and_bounded_decimal_encoding(self):
  class Hostile:
   def __le__(self,other):raise AssertionError('UNTRUSTED_COMPARISON')
   def __float__(self):raise AssertionError('UNTRUSTED_CONVERSION')
  class DecimalSubclass(D):pass
  for bad in (True,False,None,'1',1,1.0,D('NaN'),D('sNaN'),D('Infinity'),D('-Infinity'),D('-1e-1000'),D('1e999999999'),D('0e-999999999'),D('1.'+'0'*128),Hostile(),DecimalSubclass('1')):
   self.assertIs(paper_quote_book_valid(bad,D(1)),False);self.assertIs(paper_quote_book_valid(D(1),bad),False)
  self.assertIs(paper_quote_book_valid(D('1.'+'0'*127),D(1)),True)
 def test_hostile_context_precision_traps_and_existing_flags_are_unchanged(self):
  for precision in (1,2,7,28):
   with localcontext() as ctx:
    ctx.prec=precision;ctx.Emin=-2;ctx.Emax=2
    for signal in ctx.traps:ctx.traps[signal]=True
    ctx.flags[Inexact]=True;ctx.flags[Rounded]=True
    before=dict(ctx.flags)
    self.assertIs(paper_quote_book_valid(D('1e-12'),D('1e12')),True)
    self.assertIs(paper_quote_book_valid(D('sNaN'),D(1)),False)
    self.assertEqual(dict(ctx.flags),before)
 def test_existing_d88_kernel_bytes_are_an_immutable_prefix(self):
  import market_math
  raw=pathlib.Path(market_math.__file__).read_bytes()
  self.assertEqual(hashlib.sha256(raw[:51215]).hexdigest(),'57aa2f9ad056d4773c53a1e05e52781d3390cce4dbaddaef8ed54848723e5843')
 def test_direct_sdk_capability_metadata_and_canonical_identity(self):
  import market_math as canonical,market_compute_api as api
  self.assertIs(api.paper_quote_book_valid,canonical.paper_quote_book_valid)
  self.assertIs(type(api.CAUSAL_PAPER_NUMERIC_CAPABILITIES),frozenset)
  self.assertIn('paper_quote_book_valid',api.CAUSAL_PAPER_NUMERIC_CAPABILITIES)
  for name in api.CAUSAL_PAPER_NUMERIC_CAPABILITIES:self.assertIs(getattr(api,name),getattr(canonical,name))
  self.assertIsNone(importlib.util.find_spec('market_profile_math'))
if __name__=='__main__':unittest.main()
