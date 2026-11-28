"""Reviewed synthetic-only component-chain fixture, not market/source evidence."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit
from datetime import datetime, timezone, timedelta
from decimal import Decimal

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'python'))
import scientific_memory as memory
import psycopg

SOURCE = 'SYNTHETIC_LOCAL_GRID_FIXTURE'
PINS = {
 'grid': ('1e093da12a9756bb8c5e97cabf2707bee7ef4dd7', 'grid/qualified_ohlcv.py', '5e8d2a9d0c497389ea27eb024cdbd6c151e8c00d'),
 'terminan': ('d790bd42616de4712426127b55505751625fddcb', 'terminan/data.py', 'e23a16e83369631a35ad00d48d051b149df6e5e6'),
}


def pinned(name):
    commit, relative, expected = PINS[name]
    repo = ROOT.parent / name
    source = subprocess.check_output(['git', '-C', str(repo), 'show', f'{commit}:{relative}'])
    actual = subprocess.check_output(['git', 'hash-object', '--stdin'], input=source).decode().strip()
    if actual != expected:
        raise ValueError('PINNED_SOURCE_BLOB_MISMATCH')
    stage = ROOT / 'work' / 'round21-chain'
    stage.mkdir(parents=True, exist_ok=True)
    path = stage / f'pinned_{name}.py'
    path.write_bytes(source)
    if subprocess.check_output(['git', 'hash-object', str(path)]).decode().strip() != expected:
        raise ValueError('STAGED_SOURCE_BLOB_MISMATCH')
    spec = importlib.util.spec_from_file_location(f'r21_pinned_{name}', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def dsn():
    value = os.environ['SCIENTIFIC_MEMORY_TEST_DSN']
    url = urlsplit(value)
    if (url.hostname, url.path, url.username) != ('127.0.0.1', '/scientific_memory_test', 'memory_lab') or url.port is None or not 1 <= url.port <= 65535:
        raise ValueError('WORKSPACE_LAB_ONLY')
    for variable, role in (('MATH_EXPERIMENT_OWNER_URL','math_experiment_owner'),('MATH_EXPERIMENT_HOST_URL','math_experiment_host')):
        other=urlsplit(os.environ[variable])
        if (other.hostname,other.port,other.path,other.username) != ('127.0.0.1',url.port,'/math_experiment_test',role):
            raise ValueError('SAME_WORKSPACE_LAB_REQUIRED')
    return value


def connect():
    c = psycopg.connect(dsn(), autocommit=True)
    db, role, version = c.execute("SELECT current_database(),current_user,current_setting('server_version_num')::int").fetchone()
    if db != 'scientific_memory_test' or role != 'memory_lab' or not 180000 <= version < 190000:
        c.close()
        raise ValueError('WORKSPACE_LAB_ONLY')
    return c


def prepare():
    grid = pinned('grid')
    # Fixture setup owns only its dedicated schema; the actual B read is read-only.
    with connect() as c:
        c.execute('CREATE SCHEMA IF NOT EXISTS r21_chain_input')
        c.execute('CREATE TABLE IF NOT EXISTS r21_chain_input.ohlcv_1m(symbol text,ts timestamptz,open numeric,high numeric,low numeric,close numeric,volume numeric,turnover numeric,source text,PRIMARY KEY(symbol,ts))')
        c.execute("DELETE FROM r21_chain_input.ohlcv_1m WHERE symbol='R21CHAIN'")
        for i, price in enumerate((10, 12, 11, 15, 12)):
            c.execute('INSERT INTO r21_chain_input.ohlcv_1m VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                      ('R21CHAIN', datetime(1970,1,1,tzinfo=timezone.utc)+timedelta(minutes=i), Decimal(price),Decimal(price),Decimal(price),Decimal(price),Decimal(1),Decimal(price),SOURCE))
        with c.transaction():
            c.execute('SET TRANSACTION READ ONLY')
            c.execute('SET LOCAL search_path=r21_chain_input,pg_catalog')
            def reader(sql, params):
                if sql != grid.READ_SQL:
                    raise ValueError('UNREVIEWED_GRID_QUERY')
                return c.execute(sql,params).fetchall()
            # Six requested minutes intentionally retain the missing last minute.
            snapshot=grid.descriptive_snapshot('R21CHAIN',0,360000,420000,reader=reader)
    return {'fixture_kind':SOURCE,'snapshot':snapshot,'pins':{k:{'commit':v[0],'blob':v[2]} for k,v in PINS.items()}}


def persist(q):
    snapshot=q['snapshot']
    if snapshot['provenance']['source_declarations'] != [SOURCE]:
        raise ValueError('SYNTHETIC_FIXTURE_REQUIRED')
    rows=[[str(r['t']),r['open'],r['high'],r['low'],r['close'],r['volume'],r['turnover']] for r in reversed(snapshot['rows'])]
    record=memory.build_record('R21CHAIN',rows,memory.digest(rows),'at_most','0')
    record.pop('id')
    record['dataset']['source']=SOURCE
    identity={k:record['dataset'][k] for k in ('symbol','interval','source','sha256')}
    record['dataset']['id']=memory.digest(identity)
    record['provenance']['provider']=SOURCE
    record['provenance']['admission']='SYNTHETIC_ONLY_NOT_MARKET_SOURCE_EVIDENCE'
    record['pipeline_refs']=q['pipeline_refs']
    record['id']=memory.digest(record)
    with connect() as c:
        c.execute((ROOT/'python/scientific_memory.sql').read_text())
        memory.save(c,record)
        remembered=memory.read_qualified(c,'R21CHAIN',100)
    return {'record':record,'qualification':next(x for x in remembered['qualifications'] if x['id']==record['id'])}


def consume(q):
    consumer=pinned('terminan')
    records=consumer.scientific_memory(q['url'],'R21CHAIN',100)
    record=next(x for x in records if x['id']==q['record_id'])
    return {'record':record,'consumer_commit':PINS['terminan'][0],'consumer_blob':PINS['terminan'][2]}


if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='serve':
        # Identity guard precedes the actual P loopback HTTP listener.
        with connect():
            pass
        memory.serve(dsn(),0)
    else:
        raw=sys.stdin.buffer.read(262145)
        if len(raw)>262144:
            raise ValueError('INPUT_LIMIT')
        q=json.loads(raw) if raw else {}
        result=prepare() if mode=='prepare' else persist(q) if mode=='persist' else consume(q) if mode=='consume' else None
        if result is None:
            raise ValueError('UNKNOWN_MODE')
        print(json.dumps(result,separators=(',',':'),allow_nan=False))
