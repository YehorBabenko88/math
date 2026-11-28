import sys,json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from grid.qualified_ohlcv import descriptive_snapshot,READ_SQL

def produce(n, present):
    start=120000; end=start+n*60000; cutoff=end+60000
    epoch=datetime(1970,1,1,tzinfo=timezone.utc)
    rows=[(epoch+timedelta(milliseconds=start+i*60000),Decimal('0.000000000000000001'),Decimal('2'),Decimal('0.5'),Decimal('1.5'),Decimal('1'),None if i%2 else Decimal('1.000000000000000001'),'BYBIT_REST' if i%2 else 'BYBIT_WS') for i in present]
    calls=[]
    def reader(sql,params):
        calls.append((sql,params)); return rows
    q=descriptive_snapshot('ETHUSDT',start,end,cutoff,reader=reader)
    assert calls==[(READ_SQL,('ETHUSDT',epoch+timedelta(milliseconds=start),epoch+timedelta(milliseconds=end),n+1))]
    return q

print(json.dumps({'complete':produce(4,range(4)), 'gapped':produce(6,[1,3]), 'empty':produce(4,[]), 'limit':produce(257,range(257))},allow_nan=False))
