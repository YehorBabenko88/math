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
