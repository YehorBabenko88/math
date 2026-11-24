"""Full supplied funding rows require a pure public domain gate."""
from decimal import Decimal as D,localcontext,Inexact,Rounded
import hashlib,pathlib,unittest
from pathlib import Path
from market_math import paper_quote_funding_valid
def _verified_archival_math_source(current):
 fixture=Path(__file__).parent/'fixtures/historical_ohlc_transition'
 helper=Path(__file__).parent/'math_source_transition_custody.py';raw=helper.read_bytes()
 if hashlib.sha256(raw).hexdigest()!='aa0d833fcd15bf4f4d9b6674011fa6f7efbc38aaefb083d2f5aa5b717d9b243f':raise ValueError('DEV_SOURCE_CUSTODY_HELPER_SEAL')
 namespace={};exec(compile(raw,str(helper),'exec'),namespace)
 return namespace['verified_archival_source'](current,(fixture/'market_math_500.py.txt').read_bytes(),(fixture/'transition.json').read_bytes())

class QuoteFundingDomainTests(unittest.TestCase):
 def test_literal_bounds_signed_rates_and_unknown_mark_refuse(self):
  for mark,rate,expected in [('1e-12','-1',True),('1e12','1',True),('100','-0',True),('0','0',False),('-0','0',False),('0.000000000000999999999','0',False),('1000000000000.0000000001','0',False),('100','1.000000000000000000001',False),('100','-1.000000000000000000001',False)]:
   result=paper_quote_funding_valid(D(mark),D(rate));self.assertIs(type(result),bool);self.assertIs(result,expected)
 def test_every_operand_has_strict_finite_exact_decimal_domain(self):
  class Hostile:
   def __le__(self,other):raise AssertionError('UNTRUSTED_COMPARISON')
   def __float__(self):raise AssertionError('UNTRUSTED_CONVERSION')
  class Subclass(D):pass
  for value in (True,False,None,1,1.0,'1',D('NaN'),D('sNaN'),D('Infinity'),D('-Infinity'),D('1e999999999'),D('0e-999999999'),D('1.'+'0'*128),Hostile(),Subclass('1')):
   self.assertIs(paper_quote_funding_valid(value,D(0)),False);self.assertIs(paper_quote_funding_valid(D(100),value),False)
  self.assertIs(paper_quote_funding_valid(D('1.'+'0'*127),D('0.'+'0'*127)),True)
 def test_hostile_contexts_and_preexisting_flags_remain_unchanged(self):
  for precision in (1,2,3,5,28):
   with localcontext() as context:
    context.prec=precision;context.Emin=-2;context.Emax=2
    for signal in context.traps:context.traps[signal]=True
    context.flags[Inexact]=True;context.flags[Rounded]=True;before=dict(context.flags)
    self.assertIs(paper_quote_funding_valid(D('1e-12'),D('-1e-1000')),True)
    self.assertIs(paper_quote_funding_valid(D('1e12'),D('sNaN')),False)
    self.assertEqual(dict(context.flags),before)
 def test_verified_archival_book_predicate_prefix_has_exact_seal(self):
  import market_math
  archival=_verified_archival_math_source(pathlib.Path(market_math.__file__).read_bytes())
  self.assertEqual(hashlib.sha256(archival[:51719]).hexdigest(),'b43c5d98c9a3e7c75682b5a395f16cd80d3e40b3058c8f52bf172812dccac3fe')
 def test_public_api_identity_and_capability_metadata(self):
  import market_math,market_compute_api
  self.assertIs(market_math.paper_quote_funding_valid,market_compute_api.paper_quote_funding_valid)
  self.assertIn('paper_quote_funding_valid',market_compute_api.CAUSAL_PAPER_NUMERIC_CAPABILITIES)
if __name__=='__main__':unittest.main()
