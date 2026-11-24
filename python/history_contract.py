"""Timestamp-aware pure Math API; source authentication stays with its owner."""
import hashlib
import math
from history_worker import canonical, evaluate

MODEL='grid-frozen-analog-v1'
MAX_INPUT_BYTES=2*1024*1024

def digest(v):return hashlib.sha256(canonical(v)).hexdigest()
def hexpin(v,n=64):return isinstance(v,str) and len(v)==n and all(c in '0123456789abcdef' for c in v)
def clock(v):return type(v) is int and 0<=v<=2**53-1
def number(v):return type(v) in (int,float) and math.isfinite(v)


def evaluate_timed_request(q):
    try:
        required={'schema','dataset_id','dataset_fingerprint','source','market','units','rows','decision_ms',
                  'train_end_ms','train_count','max_age_ms','model_version'}
        if not isinstance(q,dict) or set(q)!=required or q['schema']!='math.history.request.v1.1':raise ValueError('TIMED_SCHEMA')
        if len(canonical(q))>MAX_INPUT_BYTES:raise ValueError('INPUT_LIMIT')
        if q['model_version']!=MODEL:raise ValueError('MODEL_VERSION')
        if not hexpin(q['dataset_id']) or not hexpin(q['dataset_fingerprint']):raise ValueError('DATASET_PIN')
        source=q['source']
        if (set(source)!={'identity','source_revision','epoch'} or not hexpin(source['source_revision'],40)
            or any(not isinstance(source[k],str) or not source[k] for k in ('identity','epoch'))):raise ValueError('SOURCE_IDENTITY')
        if q['market'] not in ({'venue':'bybit','market_type':'linear','symbol':'BTCUSDT'},
                               {'venue':'bybit','market_type':'spot','symbol':'BTCUSDT'}):raise ValueError('MARKET')
        if q['units']!={'price':'USDT/BTC','volume':'BTC'}:raise ValueError('UNITS')
        if not all(clock(q[k]) for k in ('decision_ms','train_end_ms','max_age_ms')):raise ValueError('CLOCK')
        rows=q['rows'];train=q['train_count']
        if not isinstance(rows,list) or not 20<=len(rows)<=2000 or type(train) is not int or not 20<=train<=len(rows):raise ValueError('ROWS_OR_TRAIN')
        previous=None
        for i,r in enumerate(rows):
            if not all(clock(r[k]) for k in ('event_start_ms','event_end_ms','source_event_start_ms','source_event_end_ms','watermark_ms','available_at_ms')):raise ValueError('ROW_CLOCK')
            if not r['event_start_ms']<=r['source_event_start_ms']<=r['source_event_end_ms']<r['event_end_ms']:raise ValueError('SOURCE_EVENT_CLOCK')
            if (r['event_start_ms']%60000 or r['event_end_ms']!=r['event_start_ms']+60000
                or previous is not None and r['event_start_ms']!=previous):raise ValueError('GAP_OR_DUPLICATE')
            previous=r['event_end_ms']
            if not r['event_end_ms']<=r['watermark_ms']<=r['available_at_ms']<=q['decision_ms']:raise ValueError('FEATURE_LOOKAHEAD')
            if i<train and r['available_at_ms']>q['train_end_ms']:raise ValueError('TRAIN_LABEL_LOOKAHEAD')
            if not hexpin(r['revision']) or not hexpin(r['source_receipt_hash']):raise ValueError('ROW_PROVENANCE')
            if any(not number(r[k]) for k in ('open','high','low','close','volume')):raise ValueError('NONFINITE')
            if not 0<r['low']<=min(r['open'],r['close'])<=max(r['open'],r['close'])<=r['high'] or r['volume']<0:raise ValueError('OHLCV')
        if q['decision_ms']-rows[-1]['event_end_ms']>q['max_age_ms']:raise ValueError('STALE_FEATURE')
        if not clock(rows[-1]['event_end_ms']+60000):raise ValueError('TARGET_CLOCK')
        if rows[-1]['event_end_ms']+60000<=q['decision_ms']:raise ValueError('HORIZON_ALREADY_KNOWN')
        legacy=evaluate({'schema':'math.history.request.v1','prices':[r['close'] for r in rows],
                         'dataset_fingerprint':q['dataset_fingerprint'],'train_count':train})
        return {**legacy,'schema':'math.history.result.v1.1','request_digest':digest(q),
            'dataset_id':q['dataset_id'],'prefix_digest':digest(rows),'model_version':MODEL,
            'source':source,'source_authenticity':'NOT_EVALUATED_BY_MATH',
            'feature_available_at_ms':max(r['available_at_ms'] for r in rows),
            'feature_event_end_ms':rows[-1]['event_end_ms'],'sample_count':len(rows),
            'forecast_target_event_end_ms':rows[-1]['event_end_ms']+60000,
            'watermark_ms':max(r['watermark_ms'] for r in rows),'decision_ms':q['decision_ms'],
            'train_end_ms':q['train_end_ms'],'train_count':train}
    except (KeyError,TypeError,OverflowError) as exc:
        raise ValueError('TIMED_REQUEST_UNAVAILABLE') from exc
