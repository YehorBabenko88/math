"""Historical binary64 footprint integrity has one Math-owned policy."""
from copy import deepcopy
from math import ulp
from pathlib import Path
import hashlib
import json
import math
import unittest
from market_profile_math import historical_aggregate_integrity


def row():
    return dict(open=1.0,high=2.0,low=1.0,close=2.0,buy_volume=3.0,sell_volume=0.0,delta=3.0,
        trade_count=3,poc_price=2.0,levels=[
            dict(price=1.0,buy_volume=1.0,sell_volume=0.0,delta=1.0,volume=1.0,buy_count=1,sell_count=0),
            dict(price=2.0,buy_volume=2.0,sell_volume=0.0,delta=2.0,volume=2.0,buy_count=2,sell_count=0)])


class HistoricalAggregateIntegrityTests(unittest.TestCase):
    def test_valid_partition_poc_and_input_immutability(self):
        sample=row();before=deepcopy(sample)
        self.assertTrue(historical_aggregate_integrity(sample))
        self.assertEqual(sample,before)

    def test_malformed_nonfinite_duplicate_and_nonmaximal_poc_refuse(self):
        cases=[]
        for invalid in (float('nan'),float('inf'),float('-inf'),True,False):
            bad=row();bad['high']=invalid;cases.append(bad)
            bad=row();bad['levels'][0]['volume']=invalid;cases.append(bad)
        bad=row();bad['trade_count']=True;cases.append(bad)
        bad=row();bad['poc_price']=1.0;cases.append(bad)
        bad=row();bad['levels'][1]['price']=1.0;cases.append(bad)
        bad=row();bad['levels'][1]['buy_volume']=-1.0;cases.append(bad)
        bad=row();bad['levels'][1]['buy_count']=True;cases.append(bad)
        bad=row();bad['levels'][0]['delta']=4.0;cases.append(bad)
        bad=row();bad['buy_volume']=4.0;cases.append(bad)
        bad=row();bad['levels']=[];cases.append(bad)
        bad=row();del bad['close'];cases.append(bad)
        cases.extend((None,[],{'levels':'invalid'}))
        for sample in cases:
            with self.subTest(sample=sample):self.assertFalse(historical_aggregate_integrity(sample))

    def test_positive_price_domain_precedes_subnormal_ulp_tolerance(self):
        tiny=5e-324
        sample=dict(open=tiny,high=tiny,low=tiny,close=tiny,buy_volume=1.0,sell_volume=0.0,delta=1.0,
            trade_count=1,poc_price=tiny,levels=[dict(price=tiny,buy_volume=1.0,sell_volume=0.0,
            delta=1.0,volume=1.0,buy_count=1,sell_count=0)])
        for price,want in ((0.0,False),(-0.0,False),(-tiny,False),(tiny,True),(2*tiny,True),(9*tiny,True),(10*tiny,False)):
            candidate=deepcopy(sample);candidate['poc_price']=candidate['levels'][0]['price']=price
            with self.subTest(price=price):self.assertEqual(historical_aggregate_integrity(candidate),want)

    @staticmethod
    def zero_quantity_row():
        return dict(open=1.0,high=1.0,low=1.0,close=1.0,buy_volume=0.0,sell_volume=0.0,delta=0.0,
            trade_count=1,poc_price=1.0,levels=[dict(price=1.0,buy_volume=0.0,sell_volume=0.0,
            delta=0.0,volume=0.0,buy_count=1,sell_count=0)])

    def test_entire_price_domain_matrix(self):
        for owner,field in [(None,x) for x in ('open','high','low','close','poc_price')]+[(0,'price')]:
            for invalid in (0.0,-0.0,-5e-324,-1.0,float('nan'),float('inf'),float('-inf'),True,False):
                sample=self.zero_quantity_row()
                target=sample if owner is None else sample['levels'][owner];target[field]=invalid
                with self.subTest(field=field,invalid=invalid):self.assertFalse(historical_aggregate_integrity(sample))

    def test_entire_unsigned_quantity_domain_matrix(self):
        for owner,field in [(None,'buy_volume'),(None,'sell_volume'),(0,'buy_volume'),(0,'sell_volume'),(0,'volume')]:
            for value,want in ((-1.0,False),(-1e-12,False),(-5e-324,False),(float('nan'),False),
                               (float('inf'),False),(float('-inf'),False),(True,False),(False,False),
                               (0.0,True),(-0.0,True),(5e-324,True),(0.5e-9,True)):
                sample=self.zero_quantity_row()
                target=sample if owner is None else sample['levels'][owner];target[field]=value
                with self.subTest(owner=owner,field=field,value=value):
                    self.assertEqual(historical_aggregate_integrity(sample),want)

    def test_signed_delta_domain_retains_negative_and_zero_values(self):
        sample=self.zero_quantity_row()
        sample.update(sell_volume=1.0,delta=-1.0)
        sample['levels'][0].update(sell_volume=1.0,delta=-1.0,volume=1.0,buy_count=0,sell_count=1)
        self.assertTrue(historical_aggregate_integrity(sample))
        for owner in (None,0):
            for value,want in ((-5e-324,True),(0.0,True),(-0.0,True),(5e-324,True),
                               (float('nan'),False),(float('inf'),False),(float('-inf'),False),(True,False),(False,False)):
                candidate=self.zero_quantity_row()
                target=candidate if owner is None else candidate['levels'][owner];target['delta']=value
                with self.subTest(owner=owner,value=value):self.assertEqual(historical_aggregate_integrity(candidate),want)

    def test_count_domain_is_integer_and_not_bool(self):
        for value in (True,False,0,-1,1.0,-0.0,5e-324,float('nan'),float('inf')):
            sample=self.zero_quantity_row();sample['trade_count']=value
            with self.subTest(field='trade_count',value=value):self.assertFalse(historical_aggregate_integrity(sample))
        for field in ('buy_count','sell_count'):
            for value in (True,False,-1,1.0,-0.0,5e-324,float('nan'),float('inf')):
                sample=self.zero_quantity_row();sample['levels'][0][field]=value
                with self.subTest(field=field,value=value):self.assertFalse(historical_aggregate_integrity(sample))
            for value in (0,1,2):
                sample=self.zero_quantity_row();cell=sample['levels'][0]
                cell['buy_count']=cell['sell_count']=1;cell[field]=value
                sample['trade_count']=cell['buy_count']+cell['sell_count']
                with self.subTest(field=field,value=value):self.assertTrue(historical_aggregate_integrity(sample))

    def test_immutable_original_source_parity_supplements_hand_oracles(self):
        source=(Path(__file__).parent/'fixtures/historical_integrity_fa09e688.py.txt').read_bytes()
        self.assertEqual(hashlib.sha256(source).hexdigest(),'0f417cef63f103f347a0e0b90deba650888af86922862f6f464f35dcc265657b')
        namespace={'math':math,'canonical':lambda value:json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()}
        exec(compile(source,'<historical-source-fa09e688>','exec'),namespace)
        original=namespace['data_integrity']
        for offset in (0.0,0.5e-9,1e-9,2e-9,-0.5e-9):
            for field in ('delta','buy_volume','sell_volume','poc_price','trade_count'):
                candidate=row();candidate[field]+=offset
                with self.subTest(offset=offset,field=field):
                    if min(candidate['buy_volume'],candidate['sell_volume'])<0:
                        self.assertTrue(original(candidate),'historical invalid-domain loophole')
                        self.assertFalse(historical_aggregate_integrity(candidate))
                    else:
                        self.assertEqual(historical_aggregate_integrity(candidate),original(candidate))
        for invalid in (float('nan'),float('inf'),True):
            candidate=row();candidate['levels'][1]['volume']=invalid
            self.assertEqual(historical_aggregate_integrity(candidate),original(candidate))

    def test_eight_ulp_price_boundary_and_absolute_quantity_tolerance_are_preserved(self):
        sample=row();sample['open']=sample['close']=sample['low']=sample['high']=0.3
        sample['levels']=sample['levels'][:1]
        sample['trade_count']=1;sample['buy_volume']=sample['delta']=1.0
        for steps,want in ((1,True),(8,True),(9,False)):
            sample['poc_price']=sample['levels'][0]['price']=0.3+steps*ulp(0.3)
            self.assertEqual(historical_aggregate_integrity(sample),want)
        sample=row();sample['levels'][0]['delta']=1.0+0.5e-9
        self.assertTrue(historical_aggregate_integrity(sample))
        sample['levels'][0]['delta']=1.0+2e-9
        self.assertFalse(historical_aggregate_integrity(sample))

if __name__=='__main__':unittest.main()
