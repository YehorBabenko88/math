"""Persist and read bounded, content-addressed research results owned by Math."""

import argparse
from decimal import Decimal, localcontext
from fractions import Fraction
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import re
from urllib.parse import parse_qs, urlsplit

from history_statistics import project_decimal_observations
from history_timeseries import acf

RECORD = 'math.scientific-memory.record.v1'
LIST = 'math.scientific-memory.list.v1'
SOURCE = 'https://api.bybit.com/v5/market/kline'
HASH = re.compile(r'[a-f0-9]{64}')
SYMBOL = re.compile(r'[A-Z0-9]{2,30}')
NUMERIC = re.compile(r'-?[0-9]+(?:\.[0-9]+)?')
MILLISECONDS = re.compile(r'(?:0|[1-9][0-9]{0,15})')
OPERATORS = {'at_most', 'at_least'}
MAX_RECORD_BYTES = 8192


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True, allow_nan=False)


def digest(value):
    return sha256(canonical(value).encode('ascii')).hexdigest()


def decimal_text(value):
    if type(value) is not str or len(value) > 64 or not NUMERIC.fullmatch(value):
        raise ValueError('Invalid exact Decimal')
    return Decimal(value)


def exact_acf(values, max_lag):
    rational = [Fraction(value) for value in values]
    mean = sum(rational) / len(rational)
    centered = [value - mean for value in rational]
    denominator = sum(value * value for value in centered)
    if denominator == 0:
        # ACF is a normalized covariance: constant differences have no
        # denominator and MUST NOT become a reproduced/contradicted claim.
        raise ValueError('Undefined normalized autocorrelation')
    return [Fraction(1), *[
        sum(a * b for a, b in zip(centered[lag:], centered)) / denominator
        for lag in range(1, max_lag + 1)
    ]]


def build_record(symbol, rows, pinned_sha256, operator, threshold):
    """Build a descriptive ACF claim from a pinned Bybit response in newest-first order."""
    if type(symbol) is not str or not SYMBOL.fullmatch(symbol) or operator not in OPERATORS:
        raise ValueError('Invalid research scope')
    target = Fraction(decimal_text(threshold))
    if not -1 <= target <= 1 or type(rows) is not list or not 4 <= len(rows) <= 512:
        raise ValueError('Invalid threshold or dataset size')
    timestamps, closes = [], []
    for row in rows:
        if type(row) is not list or len(row) != 7 or type(row[0]) is not str or not MILLISECONDS.fullmatch(row[0]):
            raise ValueError('Invalid OHLCV row')
        stamp = int(row[0])
        if stamp % 60000 or stamp > 2**53 - 1 or (timestamps and timestamps[-1] - stamp != 60000):
            raise ValueError('Expected descending, contiguous UTC minute bars')
        values = [decimal_text(value) for value in row[1:]]
        if min(values) < 0 or not values[2] <= min(values[0], values[3]) <= max(values[0], values[3]) <= values[1]:
            raise ValueError('Invalid market values')
        timestamps.append(stamp)
        closes.append(values[3])
    if digest(rows) != pinned_sha256:
        raise ValueError('Dataset bytes differ from the pinned rows')
    with localcontext() as context:
        context.prec = 128
        changes = [right - left for left, right in zip(reversed(closes[1:]), reversed(closes[:-1]))]
    max_lag = 2
    # Compute the exact denominator first. If zero, never produce a floating
    # approximation or a scientific claim about an undefined ACF.
    reference = exact_acf(changes, max_lag)
    observed = acf(project_decimal_observations(changes), max_lag=max_lag)
    error = [str(abs(Fraction(actual) - expected)) for actual, expected in zip(observed, reference)]
    satisfied = reference[1] <= target if operator == 'at_most' else reference[1] >= target
    identity = {'symbol': symbol, 'interval': '1m', 'source': SOURCE, 'sha256': pinned_sha256}
    record = {
        'schema': RECORD, 'symbol': symbol, 'input_hash': pinned_sha256,
        'dataset': {**identity, 'id': digest(identity), 'rows': len(rows), 'start_ms': timestamps[-1],
                    'end_ms': timestamps[0], 'time_encoding': 'unix_ms_utc'},
        'space': 'time_series', 'algorithm': 'math.history.acf.v1',
        'parameters': {'input': 'consecutive_close_deltas', 'max_lag': max_lag, 'claim_lag': 1,
                       'claim_operator': operator, 'claim_threshold': threshold},
        'status': 'reproduced' if satisfied else 'contradicted',
        'result': {'acf': observed, 'exact_reference': [str(value) for value in reference],
                   'absolute_error': error, 'error_encoding': 'exact_fraction',
                   'decision_basis': 'exact_reference_lag_1'},
        'provenance': {'provider': 'Bybit', 'collector': 'Grid', 'compute_owner': 'Math',
                       'admission': 'pinned_input_not_exchange_completeness_attestation',
                       'scope': 'descriptive_observations_only', 'execution_authority': False,
                       'trading_authorized': False},
        'reproducibility': {'projection': 'DECIMAL_TO_BINARY64_V1', 'observations': len(changes),
                            'reference': 'direct_rational_acf'},
    }
    return {**record, 'id': digest(record)}


def decode_record(expected_id, record):
    if not isinstance(record, dict) or record.get('schema') != RECORD or record.get('id') != expected_id:
        raise ValueError('Invalid persisted record identity')
    dataset = record.get('dataset')
    if (not isinstance(dataset, dict) or dataset.get('symbol') != record.get('symbol')
            or not isinstance(record.get('input_hash'), str) or not HASH.fullmatch(record['input_hash'])
            or dataset.get('sha256') != record['input_hash'] or record.get('status') not in ('reproduced', 'contradicted')):
        raise ValueError('Invalid persisted research scope')
    if digest({key: value for key, value in record.items() if key != 'id'}) != expected_id:
        raise ValueError('Persisted content fingerprint mismatch')
    return record


def qualify_historical_record(record):
    """Fail-closed READ projection; a self-hash is not a source or proof receipt.

    Preserve the immutable v1 record and descriptive outcome verbatim.
    Nothing supplied in the v1 record can upgrade these trust dimensions.
    """
    if not isinstance(record, dict):
        raise ValueError('Invalid persisted record identity')
    decode_record(record.get('id'), record)
    provenance = record.get('provenance')
    # The original descriptive v1 producer always emitted explicit false
    # authority flags. A rehashed caller-positive claim is not a verified
    # result and must fail closed rather than sharing a negative sidecar.
    if (type(provenance) is not dict
            or provenance.get('execution_authority') is not False
            or provenance.get('trading_authorized') is not False):
        raise ValueError('Untrusted historical authority claim')
    return {
        'id': record['id'],
        'descriptive_outcome': record['status'],
        'source_authenticity': 'UNATTESTED',
        'fit_binding': 'NOT_PROVIDED',
        'method_validation': 'UNVERIFIED',
        'empirical_reproduction': 'UNKNOWN',
        'formal_proof': 'NOT_ESTABLISHED',
        'causal_eligibility': 'UNKNOWN',
        'execution_authority': False,
        'trading_authorized': False,
    }


def save(connection, record):
    # Admission is deny-only and MUST precede a transaction or any SQL.
    # A caller-controlled self-hash is not a protected authority receipt.
    # Do not persist records the existing read-side projection would refuse.
    qualify_historical_record(record)
    record_id = record['id']
    payload = canonical(record)
    if len(payload) > MAX_RECORD_BYTES:
        raise ValueError('Record too large')
    # Enter the transaction BEFORE the first SELECT. psycopg with
    # autocommit=False implicitly starts a transaction on any statement:
    # doing the initial SELECT outside this block would turn the subsequent
    # transaction() into a SAVEPOINT and leave new inserts uncommitted.
    # The caller retains control of an already-open outer transaction.
    with connection.transaction():
        existing = connection.execute(
            'SELECT payload FROM public.mu_scientific_runs WHERE id=%s',
            (record_id,),
        ).fetchone()
        if existing is not None:
            if existing != (payload,):
                raise ValueError('Persisted content conflict')
            # Exact replay performs SELECT only, not INSERT/UPDATE/DELETE.
            # The read-only transaction may still acquire PostgreSQL locks.
            return record_id
        # A unique primary key resolves competing first inserts; reconcile
        # against the original bytes without changing any existing row.
        connection.execute('''INSERT INTO public.mu_scientific_runs (id, symbol, payload)
                              VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING''',
                           (record_id, record['symbol'], payload))
        existing = connection.execute('SELECT payload FROM public.mu_scientific_runs WHERE id=%s', (record_id,)).fetchone()
        if existing != (payload,):
            raise ValueError('Persisted content conflict')
    return record_id


def read(connection, symbol, limit):
    if not SYMBOL.fullmatch(symbol) or type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError('Invalid symbol or limit')
    rows = connection.execute('''SELECT id,payload FROM public.mu_scientific_runs WHERE symbol=%s
                                 ORDER BY stored_at DESC,id DESC LIMIT %s''', (symbol, limit))
    records = []
    for record_id, payload in rows:
        # A record id is derived from *canonical* JSON, not arbitrary JSONB
        # reserialization. Noncanonical text, whitespace, duplicate keys and
        # invalid encodings are NOT historical byte-identity evidence.
        if type(payload) is not str or not 2 <= len(payload) <= MAX_RECORD_BYTES:
            raise ValueError('Persisted record payload encoding mismatch')
        record = decode_record(record_id, json.loads(payload))
        if payload != canonical(record):
            raise ValueError('Persisted record noncanonical bytes')
        if record.get('symbol') != symbol:
            raise ValueError('Persisted result belongs to another symbol')
        records.append(record)
    # Legacy /v1 list schema is byte-shape compatible. A trust projection
    # must never be silently injected into a versioned legacy response.
    return {'schema': LIST, 'symbol': symbol, 'records': records}


def qualify_historical_list(response):
    """Opt-in, negative-only *derived* trust sidecar for existing v1 records.

    This does not assert Grid custody, verify a method, or admit a result.
    Record IDs, canonical bytes, and legacy list responses remain unchanged.
    The versioned sidecar is not an authorization receipt or production API.
    """
    if (type(response) is not dict or set(response) != {'schema', 'symbol', 'records'}
            or response['schema'] != LIST or type(response['symbol']) is not str
            or not SYMBOL.fullmatch(response['symbol'])
            or type(response['records']) is not list or len(response['records']) > 100):
        raise ValueError('Invalid historical scientific memory list')
    qualifications = []
    seen_ids = set()
    for record in response['records']:
        if not isinstance(record, dict) or record.get('symbol') != response['symbol']:
            raise ValueError('Historical memory record symbol mismatch')
        qualification = qualify_historical_record(record)
        if qualification['id'] in seen_ids:
            raise ValueError('Duplicate historical memory identity')
        seen_ids.add(qualification['id'])
        qualifications.append(qualification)
    return {'schema': LIST, 'symbol': response['symbol'],
            'records': response['records'],
            'qualification_schema': 'math.scientific-memory.qualification.v2',
            'qualifications': qualifications}


def read_qualified(connection, symbol, limit):
    """Dedicated opt-in read; the existing HTTP /v1 route is unchanged."""
    return qualify_historical_list(read(connection, symbol, limit))


def serve(dsn, port):
    import psycopg

    class LoopbackServer(HTTPServer):
        request_queue_size = 32

        def get_request(self):
            connection, address = super().get_request()
            connection.settimeout(6)
            return connection, address

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            try:
                url = urlsplit(self.path)
                if url.path != '/v1/scientific-memory':
                    return self.reply(404, {'error': 'not found'})
                params = parse_qs(url.query, max_num_fields=2, strict_parsing=True)
                if set(params) - {'symbol', 'limit'} or any(len(values) != 1 for values in params.values()):
                    raise ValueError('Invalid query')
                symbol = params.get('symbol', [''])[0]
                limit_str = params.get('limit', ['50'])[0]
                if not SYMBOL.fullmatch(symbol) or not re.fullmatch(r'[0-9]{1,3}', limit_str) or not 1 <= int(limit_str) <= 100:
                    raise ValueError('Invalid query')
            except ValueError:
                return self.reply(400, {'error': 'invalid query'})
            try:
                with psycopg.connect(dsn, connect_timeout=3,
                                     options='-c default_transaction_read_only=on -c statement_timeout=3000') as connection:
                    result = read_qualified(connection, symbol, int(limit_str))
                return self.reply(200, result)
            except (ValueError, psycopg.Error):
                return self.reply(503, {'error': 'scientific memory unavailable'})

        def reply(self, status, value):
            body = canonical(value).encode('ascii')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)

    with LoopbackServer(('127.0.0.1', port), Handler) as server:
        print(f'SCIENTIFIC_MEMORY_PORT={server.server_port}', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=18767)
    serve(os.environ['SCIENTIFIC_MEMORY_READ_DSN'], parser.parse_args().port)
