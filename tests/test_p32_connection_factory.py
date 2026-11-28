"""Actual loopback HTTP; no PostgreSQL socket or real driver needed."""
import builtins
from contextlib import contextmanager, redirect_stdout
import io
import json
from pathlib import Path
import queue
import sys
import threading
from types import ModuleType
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import build_opener, ProxyHandler

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import scientific_memory as memory


class Connection:
    def __init__(self, *, read_error=False, close_error=False):
        self.read_error = read_error
        self.close_error = close_error
        self.queries = []
        self.closed = 0

    def execute(self, sql, params):
        self.queries.append((sql, params))
        if self.read_error:
            raise RuntimeError('private SQL error')
        return []

    def close(self):
        self.closed += 1
        if self.close_error:
            raise RuntimeError('private close error')

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


@contextmanager
def http_server(**kwargs):
    ready = queue.Queue()
    errors = queue.Queue()
    original = memory.HTTPServer

    class ObservedServer(original):
        def serve_forever(self, *args, **kw):
            ready.put(self)
            return super().serve_forever(poll_interval=0.01)

    def run():
        try:
            memory.serve('PG_LAB_FACTORY_REQUIRED', 0, **kwargs)
        except Exception as exc:
            errors.put(exc)
            ready.put(None)

    with patch.object(memory, 'HTTPServer', ObservedServer), redirect_stdout(io.StringIO()):
        thread = threading.Thread(target=run, daemon=True)
        thread.start()
        server = ready.get(timeout=5)
        if server is None:
            thread.join(timeout=5)
            raise AssertionError('HTTP server failed to start') from errors.get_nowait()
        try:
            yield f'http://127.0.0.1:{server.server_port}'
        finally:
            server.shutdown()
            thread.join(timeout=5)
            if thread.is_alive():
                raise AssertionError('HTTP server failed to stop')
            if not errors.empty():
                raise AssertionError('HTTP server failed') from errors.get_nowait()


def request(base, query='symbol=BTCUSDT&limit=5', path='/v1/scientific-memory'):
    opener = build_opener(ProxyHandler({}))
    try:
        with opener.open(f'{base}{path}?{query}', timeout=4) as response:
            return response.status, json.load(response)
    except HTTPError as exc:
        with exc:
            return exc.code, json.load(exc)


@contextmanager
def forbid_driver_import():
    original = builtins.__import__
    attempts = []

    def no_driver(name, *args, **kwargs):
        if name == 'psycopg' or name.startswith('psycopg.'):
            attempts.append(name)
            raise AssertionError('raw psycopg import forbidden in factory mode')
        return original(name, *args, **kwargs)

    with patch('builtins.__import__', side_effect=no_driver):
        yield attempts


class P32FactoryHTTP(unittest.TestCase):
    def test_each_request_opens_fresh_factory_connection_and_closes(self):
        opened = []

        def factory():
            connection = Connection()
            opened.append(connection)
            return connection

        with forbid_driver_import() as imports, http_server(connection_factory=factory) as base:
            self.assertEqual(len(opened), 0)
            first = request(base)
            second = request(base)
        self.assertEqual(imports, [])
        self.assertEqual(first, second)
        self.assertEqual(first[0], 200)
        self.assertEqual(first[1]['records'], [])
        self.assertEqual(first[1]['qualifications'], [])
        self.assertEqual(len(opened), 2)
        self.assertIsNot(opened[0], opened[1])
        for connection in opened:
            self.assertEqual(connection.closed, 1)
            self.assertEqual(len(connection.queries), 1)
            self.assertEqual(connection.queries[0][1], ('BTCUSDT', 5))

    def test_guard_refusal_on_reconnect_no_scientific_select_or_fallback(self):
        first = Connection()
        refused = Connection()
        calls = []

        def factory():
            calls.append('verify identity')
            if len(calls) == 1:
                return first
            # The trusted Q guard owns cleanup before returning a connection.
            refused.close()
            raise ValueError('PG_LAB_REFUSED')

        with forbid_driver_import() as imports, http_server(connection_factory=factory) as base:
            self.assertEqual(request(base)[0], 200)
            self.assertEqual(request(base), (503, {'error': 'scientific memory unavailable'}))
        self.assertEqual(imports, [])
        self.assertEqual(len(calls), 2)
        self.assertEqual(len(first.queries), 1)
        self.assertEqual(refused.queries, [])
        self.assertEqual((first.closed, refused.closed), (1, 1))

    def test_invalid_http_input_never_opens_factory(self):
        calls = []

        def factory():
            calls.append(1)
            raise AssertionError('invalid request opened factory')

        with forbid_driver_import() as imports, http_server(connection_factory=factory) as base:
            for query in ('symbol=BTCUSDT&limit=0', 'symbol=BTCUSDT&symbol=ETHUSDT',
                          'symbol=BTCUSDT&connection_factory=evil', 'symbol=BTCUSDT&dsn=evil',
                          'symbol=bad&limit=5'):
                with self.subTest(query=query):
                    self.assertEqual(request(base, query)[0], 400)
            self.assertEqual(request(base, path='/bad')[0], 404)
        self.assertEqual(calls, [])
        self.assertEqual(imports, [])

    def test_factory_exception_returns_generic_denial(self):
        def factory():
            raise OSError('private credential or transport error')

        with forbid_driver_import() as imports, http_server(connection_factory=factory) as base:
            self.assertEqual(request(base), (503, {'error': 'scientific memory unavailable'}))
        self.assertEqual(imports, [])

    def test_query_exception_closes_connection_and_recovers_next_request(self):
        opened = [Connection(read_error=True), Connection()]
        pending = iter(opened)
        with forbid_driver_import() as imports, http_server(connection_factory=lambda: next(pending)) as base:
            self.assertEqual(request(base), (503, {'error': 'scientific memory unavailable'}))
            self.assertEqual(request(base)[0], 200)
        self.assertEqual(imports, [])
        self.assertEqual([c.closed for c in opened], [1, 1])
        self.assertEqual([len(c.queries) for c in opened], [1, 1])

    def test_close_failure_does_not_return_success(self):
        connection = Connection(close_error=True)
        with forbid_driver_import() as imports, http_server(connection_factory=lambda: connection) as base:
            self.assertEqual(request(base), (503, {'error': 'scientific memory unavailable'}))
        self.assertEqual(imports, [])
        self.assertEqual(connection.closed, 1)

    def test_noncallable_factory_rejected_before_server_or_driver(self):
        with forbid_driver_import() as imports, patch.object(memory, 'HTTPServer') as server:
            with self.assertRaises(TypeError):
                memory.serve('invalid', 0, connection_factory=False)
        server.assert_not_called()
        self.assertEqual(imports, [])

    def test_legacy_dsn_reader_preserves_connection_options_and_context(self):
        connection = Connection()
        calls = []
        driver = ModuleType('psycopg')
        driver.Error = type('DriverError', (Exception,), {})

        def connect(*args, **kwargs):
            calls.append((args, kwargs))
            return connection

        driver.connect = connect
        with patch.dict(sys.modules, {'psycopg': driver}), http_server() as base:
            self.assertEqual(request(base)[0], 200)
        self.assertEqual(calls, [(('PG_LAB_FACTORY_REQUIRED',), {
            'connect_timeout': 3,
            'options': '-c default_transaction_read_only=on -c statement_timeout=3000'})])
        self.assertEqual(connection.closed, 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
