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
from history_nonlinear import local_analog_forecast
from history_timeseries import rolling_volatility, difference

def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),allow_nan=False).encode()

def evaluate(q):
    if not isinstance(q,dict) or set(q)!={'schema','prices','dataset_fingerprint'} or q['schema']!='math.history.request.v1':raise ValueError('SCHEMA')
    x=q['prices']
    if not isinstance(x,list) or not 20<=len(x)<=2000 or any(type(v) not in (int,float) or not math.isfinite(v) or v<=0 for v in x):raise ValueError('PRICES')
    fp=q['dataset_fingerprint']
    if not isinstance(fp,str) or len(fp)!=64 or any(c not in '0123456789abcdef' for c in fp):raise ValueError('FINGERPRINT')
    prediction=local_analog_forecast(x,p=4,lag=1,horizon=1,k=20,theiler=10)
    forecast=prediction['forecast'] if prediction else x[-1]
    vol=rolling_volatility(difference(x),window=20)[-1]
    if not all(math.isfinite(v) for v in (forecast,vol)) or forecast<=0:raise ValueError('NONFINITE')
    return {'schema':'math.history.result.v1','request_digest':hashlib.sha256(canonical(q)).hexdigest(),
      'dataset_fingerprint':fp,'kernel':'grid-analog-v1','forecast':forecast,'volatility':vol,
      'execution_authority':False,'trading_authorized':False,'training_authorized':False}

def main():
    raw=sys.stdin.buffer.read(262145)
    if len(raw)>262144:raise ValueError('INPUT_LIMIT')
    q=json.loads(raw)
    sys.stdout.buffer.write(canonical(evaluate(q)))

if __name__=='__main__':main()
