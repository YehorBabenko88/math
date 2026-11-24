import copy
import hashlib
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'python'))
from history_contract import evaluate_timed_request
from history_worker import evaluate

def request():
    rows=[{'open':100+i*.1,'high':102+i*.1,'low':99+i*.1,'close':101+i*.1,'volume':3.,
       'event_start_ms':i*60000,'event_end_ms':(i+1)*60000,'available_at_ms':(i+1)*60000,
       'watermark_ms':(i+1)*60000,'revision':'a'*64,'source_receipt_hash':'b'*64} for i in range(40)]
    for row in rows:row.update(source_event_start_ms=row['event_start_ms']+1,source_event_end_ms=row['event_end_ms']-2)
    return {'schema':'math.history.request.v1.1','dataset_id':'c'*64,'dataset_fingerprint':'d'*64,
      'source':{'identity':'fixture','source_revision':'a'*40,'epoch':'fixture'},
      'market':{'venue':'bybit','market_type':'linear','symbol':'BTCUSDT'},
      'units':{'price':'USDT/BTC','volume':'BTC'},'rows':rows,'decision_ms':40*60000,
      'train_end_ms':30*60000,'train_count':30,'max_age_ms':60000,'model_version':'grid-frozen-analog-v1'}


class TimedMath(unittest.TestCase):
    def test_published_after_target_is_not_a_future_forecast(self):
        q=request();q['decision_ms']=2460000
        with self.assertRaisesRegex(ValueError,'HORIZON_ALREADY_KNOWN'):
            evaluate_timed_request(q)

    def test_target_event_time_cannot_overflow_wire_clock(self):
        q=request();shift=((2**53-1)//60000-40)*60000
        for row in q['rows']:
            for k in ('event_start_ms','event_end_ms','source_event_start_ms','source_event_end_ms','available_at_ms','watermark_ms'):
                row[k]+=shift
        q['decision_ms']+=shift;q['train_end_ms']+=shift
        with self.assertRaises(ValueError):evaluate_timed_request(q)

    def test_exact_numerical_parity_and_identity_binding(self):
        q=request();r=evaluate_timed_request(q)
        old=evaluate({'schema':'math.history.request.v1','prices':[x['close'] for x in q['rows']],
                     'train_count':30,'dataset_fingerprint':q['dataset_fingerprint']})
        self.assertEqual((r['forecast'],r['volatility']),(old['forecast'],old['volatility']))
        self.assertEqual(r['dataset_id'],q['dataset_id'])
        self.assertEqual(r['watermark_ms'],q['decision_ms'])
        self.assertEqual(r['source_authenticity'],'NOT_EVALUATED_BY_MATH')

    def test_time_unit_train_and_model_controls(self):
        mutations=[lambda q:q.update(model_version='forged-v2'), lambda q:q['rows'][0].update(available_at_ms=999999999),
          lambda q:q['rows'][0].update(watermark_ms=120000),lambda q:q['rows'][0].update(close=float('nan')),
          lambda q:q['units'].update(price='USD/BTC'), lambda q:q.update(train_end_ms=60000),
          lambda q:q['rows'][1].update(event_start_ms=0),lambda q:q['rows'][0].update(source_receipt_hash='fake'),
          lambda q:q.update(decision_ms=q['decision_ms']+60001),lambda q:q.update(schema='math.history.request.v2')]
        for mutate in mutations:
            q=request();mutate(q)
            with self.subTest(mutate=mutate),self.assertRaises(ValueError):evaluate_timed_request(q)

if __name__=='__main__':unittest.main()
