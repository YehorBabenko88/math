import unittest
from decimal import Decimal,localcontext
from unittest.mock import patch
import market_math as m
class PaperExecutionValuesTests(unittest.TestCase):
 def api(self):
  self.assertTrue(hasattr(m,'paper_execution_values_valid'),'paper execution domain predicate absent')
  return m.paper_execution_values_valid
 def test_valid_declared_execution_returns_literal_true(self):
  f=self.api();self.assertIs(f(Decimal('100'),Decimal('101'),Decimal('.01'),Decimal('.2')),True)
 def test_first_three_strict_positive_and_fees_nonnegative(self):
  f=self.api()
  for index in range(4):
   for value in (Decimal('-1'),Decimal('0'),Decimal('-0')):
    a=[Decimal(1)]*4;a[index]=value;self.assertIs(f(*a),index==3 and value.is_zero())
 def test_coefficient_exact_boundary(self):
  f=self.api()
  for index in range(4):
   a=[Decimal(1)]*4;a[index]=Decimal('9'*128);self.assertIs(f(*a),True)
   a[index]=Decimal('9'*129);self.assertIs(f(*a),False)
 def test_exponent_exact_boundary(self):
  f=self.api()
  for index in range(4):
   for exponent in (-4096,4096,-4097,4097):
    a=[Decimal(1)]*4;a[index]=Decimal((0,(1,),exponent));self.assertIs(f(*a),abs(exponent)<=4096)
 def test_invalid_numeric_and_nonfinite_types_are_false(self):
  f=self.api()
  for index in range(4):
   for value in (True,False,None,1,1.,'1',b'1',Decimal('NaN'),Decimal('sNaN'),Decimal('Infinity'),Decimal('-Infinity')):
    a=[Decimal(1)]*4;a[index]=value;self.assertIs(f(*a),False)
 def test_foreign_subclasses_and_metaclasses_have_zero_callbacks(self):
  f=self.api();calls=[]
  class Meta(type):
   def __eq__(self,v):calls.append('meta_eq');raise AssertionError
   def __instancecheck__(self,v):calls.append('instance');raise AssertionError
  class Foreign(metaclass=Meta):
   def __float__(self):calls.append('float');raise AssertionError
   def __le__(self,v):calls.append('le');raise AssertionError
   def __lt__(self,v):calls.append('lt');raise AssertionError
   def __bool__(self):calls.append('bool');raise AssertionError
  class D(Decimal):
   def is_finite(self):calls.append('is_finite');raise AssertionError
   def as_tuple(self):calls.append('as_tuple');raise AssertionError
  for index in range(4):
   for value in (Foreign(),D('1')):
    a=[Decimal(1)]*4;a[index]=value;self.assertIs(f(*a),False)
  self.assertEqual(calls,[])
 def test_hostile_decimal_context_flags_and_traps_unchanged(self):
  f=self.api()
  for precision in (1,2,28):
   with localcontext() as c:
    c.prec=precision;c.Emax=2;c.Emin=-2
    for signal in c.traps:c.traps[signal]=True
    c.clear_flags();before=c.copy()
    for a in ((Decimal('1e4096'),Decimal('1e-4096'),Decimal(1),Decimal('-0')),(Decimal('NaN'),Decimal(1),Decimal(1),Decimal(0)),(Decimal('sNaN'),Decimal(1),Decimal(1),Decimal(0))):f(*a)
    self.assertEqual(c.flags,before.flags);self.assertEqual(c.traps,before.traps);self.assertEqual((c.prec,c.Emax,c.Emin),(before.prec,before.Emax,before.Emin))
 def test_existing_policy_reused_without_unrelated_math(self):
  f=self.api();original=m._policy_decimal;calls=[]
  def policy(v,**kw):calls.append((v,kw));return original(v,**kw)
  def unrelated(*a,**kw):raise AssertionError('unrelated numerical kernel')
  with patch.object(m,'_policy_decimal',side_effect=policy),patch.object(m,'paper_position_size',side_effect=unrelated),patch.object(m,'paper_profit_loss',create=True,side_effect=unrelated):
   self.assertIs(f(Decimal(1),Decimal(2),Decimal(3),Decimal(0)),True)
  self.assertEqual([kw for _,kw in calls],[{'positive':True}]*3+[{'nonnegative':True}])
 def test_no_pnl_or_accounting_identity_inference(self):
  f=self.api();self.assertIs(f(Decimal('1e4096'),Decimal('1e4096'),Decimal('1e4096'),Decimal('1e4096')),True)
 def test_decimal_inputs_immutable(self):
  f=self.api();a=(Decimal('1.00'),Decimal('2.000'),Decimal('3.0'),Decimal('-0.00'));before=tuple(x.as_tuple() for x in a);self.assertIs(f(*a),True);self.assertEqual(tuple(x.as_tuple() for x in a),before)
