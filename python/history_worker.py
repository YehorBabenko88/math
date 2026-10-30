"""Stdlib isolated stdin/stdout worker. Inputs are a causal prefix, never labels.

Ports preserve Grid bf9f108 semantics on finite positive admitted series. The
caller must independently admit source and bind these exact source bytes.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

# -I ignores PYTHONPATH, user site and working directory; load only sibling files.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from history_nonlinear import delay_vectors, _dist
from history_timeseries import rolling_volatility, difference

def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),allow_nan=False).encode()

def frozen_analog_forecast(x,train_count):
    """Legacy p=4/k=20 analog weighting, with an explicit frozen target pool.

    Query features may use observed OOS prices; fitted neighbors and targets may
    only use the training prefix. When train_count == len(x), this is exactly
    the legacy forecast arithmetic on the same admitted series.
    """
    rows=delay_vectors(x[:train_count],p=4,lag=1,horizon=1)
    query=[x[-1-i] for i in range(4)]
    candidates=[(_dist(query,v),target,t) for v,target,t in rows if len(x)-1-t>10]
    candidates.sort(key=lambda z:z[0]);near=candidates[:20]
    if not near:return x[-1]
    weights=[1/(d+1e-12) for d,_,_ in near];total=sum(weights)
    return sum(w*y for w,(_,y,_) in zip(weights,near))/total

def evaluate(q):
    if not isinstance(q,dict) or set(q)!={'schema','prices','dataset_fingerprint','train_count'} or q['schema']!='math.history.request.v1':raise ValueError('SCHEMA')
    x=q['prices']
    if not isinstance(x,list) or not 20<=len(x)<=2000 or any(type(v) not in (int,float) or not math.isfinite(v) or v<=0 for v in x):raise ValueError('PRICES')
    fp=q['dataset_fingerprint']
    if not isinstance(fp,str) or len(fp)!=64 or any(c not in '0123456789abcdef' for c in fp):raise ValueError('FINGERPRINT')
    train=q['train_count']
    if type(train) is not int or not 20<=train<=len(x):raise ValueError('TRAIN_COUNT')
    forecast=frozen_analog_forecast(x,train)
    vol=rolling_volatility(difference(x),window=20)[-1]
    if not all(math.isfinite(v) for v in (forecast,vol)) or forecast<=0:raise ValueError('NONFINITE')
    return {'schema':'math.history.result.v1','request_digest':hashlib.sha256(canonical(q)).hexdigest(),
      'dataset_fingerprint':fp,'kernel':'grid-frozen-analog-v1','forecast':forecast,'volatility':vol,
      'execution_authority':False,'trading_authorized':False,'training_authorized':False}

def main():
    raw=sys.stdin.buffer.read(262145)
    if len(raw)>262144:raise ValueError('INPUT_LIMIT')
    q=json.loads(raw)
    sys.stdout.buffer.write(canonical(evaluate(q)))

if __name__=='__main__':main()
