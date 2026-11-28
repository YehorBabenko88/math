"""Isolated negative tests for R3 Scientific Memory read/replay behavior.

The two numerical imports are replaced with fail-on-use sentinels. No network,
PostgreSQL, untrusted math kernels, HTTP server, or trading code is executed.
"""
import contextlib
import importlib
import importlib.util
import pathlib
import sys
import types
import unittest


def do_not_run(*_args, **_kwargs):
    raise AssertionError('Numerical engine must not run in this read/replay test')


sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'python'))
# Load an isolated copy and replace only its references. Global module-table
# mutation can corrupt unrelated numeric tests and even duplicate Fraction types.
spec = importlib.util.spec_from_file_location('scientific_memory_negative_fixture',
    pathlib.Path(__file__).resolve().parents[1] / 'python' / 'scientific_memory.py')
sm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sm)
sm.project_decimal_observations = do_not_run
sm.acf = do_not_run


class Cursor:
    def __init__(self, rows):
        self.rows = rows

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def __iter__(self):
        return iter(self.rows)


class FakeDb:
    def __init__(self):
        self.rows = {}
        self.commands = []
        self.transaction_count = 0

    @contextlib.contextmanager
    def transaction(self):
        self.transaction_count += 1
        yield

    def execute(self, sql, params):
        self.commands.append(sql.strip().split()[0])
        if 'SELECT payload FROM' in sql:
            value = self.rows.get(params[0])
            return Cursor([(value,)] if value is not None else [])
        if 'INSERT INTO' in sql:
            key, _symbol, payload = params
            self.rows.setdefault(key, payload)
            return Cursor([])
        if 'SELECT id,payload FROM' in sql:
            symbol, limit = params
            values = [(key, value) for key, value in self.rows.items()
                      if __import__('json').loads(value)['symbol'] == symbol]
            return Cursor(values[:limit])
        raise AssertionError('Unexpected SQL: ' + sql)


class FakePsycopgDb(FakeDb):
    # Simulates implicit BEGIN on SELECT and transaction()/SAVEPOINT behavior.
    def __init__(self):
        super().__init__()
        self.committed = {}
        self.in_transaction = False
        self.pending = {}
        self.root_commits = 0
        self.savepoints = 0

    @contextlib.contextmanager
    def transaction(self):
        if self.in_transaction:
            self.savepoints += 1
            yield
            return
        self.in_transaction = True
        try:
            yield
        except BaseException:
            self.pending.clear()
            raise
        else:
            self.committed.update(self.pending)
            self.root_commits += 1
        finally:
            self.pending.clear()
            self.in_transaction = False

    def execute(self, sql, params):
        self.commands.append(sql.strip().split()[0])
        # Mirrors psycopg default (autocommit=False) implicit transaction.
        if not self.in_transaction:
            self.in_transaction = True
        if 'SELECT payload FROM' in sql:
            key = params[0]
            payload = self.pending.get(key, self.committed.get(key))
            return Cursor([(payload,)] if payload is not None else [])
        if 'INSERT INTO' in sql:
            key, _symbol, payload = params
            if key not in self.pending and key not in self.committed:
                self.pending[key] = payload
            return Cursor([])
        raise AssertionError('Unexpected SQL')


def record(status='reproduced', source='FORGED_GRID', symbol='BTCUSDT'):
    value = {'schema': sm.RECORD, 'symbol': symbol,
             'dataset': {'id': 'b' * 64, 'symbol': symbol, 'sha256': 'a' * 64, 'source': source},
             'input_hash': 'a' * 64, 'status': status,
             'provenance': {'collector': source, 'execution_authority': False, 'trading_authorized': False}}
    return {**value, 'id': sm.digest(value)}


class ScientificMemoryR09NegativeTest(unittest.TestCase):
    def test_nested_authority_in_arbitrary_structures_is_refused_before_sql(self):
        for flag in ('execution_authority', 'trading_authorized'):
            for claim in (True, 0, 1, 'false', None):
                value = record()
                value['extra'] = [{'nested': {flag: claim}}]
                value['id'] = sm.digest({k:v for k,v in value.items() if k != 'id'})
                db = FakeDb()
                with self.assertRaisesRegex(ValueError, 'Untrusted historical authority claim'):
                    sm.save(db, value)
                self.assertEqual(db.commands, [])
                self.assertEqual(db.transaction_count, 0)

    def test_replay_has_select_only_sql_inside_transaction(self):
        db, value = FakeDb(), record()
        db.rows[value['id']] = sm.canonical(value)
        self.assertEqual(sm.save(db, value), value['id'])
        self.assertEqual(db.commands, ['SELECT'])
        self.assertEqual(db.transaction_count, 1)

    def test_new_record_insert_is_atomic_and_second_save_replays(self):
        db, value = FakeDb(), record('contradicted')
        self.assertEqual(sm.save(db, value), value['id'])
        self.assertEqual(db.transaction_count, 1)
        self.assertEqual(db.commands, ['SELECT', 'INSERT', 'SELECT'])
        self.assertEqual(sm.save(db, value), value['id'])
        self.assertEqual(db.transaction_count, 2)
        self.assertEqual(db.commands[-1], 'SELECT')
        self.assertEqual(len(db.rows), 1)

    def test_conflicting_persisted_bytes_fail_without_write(self):
        db, value = FakeDb(), record()
        db.rows[value['id']] = '{}'
        with self.assertRaisesRegex(ValueError, '^Persisted content conflict$'):
            sm.save(db, value)
        self.assertEqual(db.rows[value['id']], '{}')
        self.assertEqual(db.commands, ['SELECT'])
        self.assertEqual(db.transaction_count, 1)

    def test_concurrent_conflicting_first_insert_is_rejected(self):
        value = record()

        class RacingDb(FakeDb):
            def execute(self, sql, params):
                if 'INSERT INTO' in sql:
                    # Simulate a competing committed row with identical ID
                    # but different stored bytes before this attempt commits.
                    self.rows[params[0]] = '{}'
                return super().execute(sql, params)

        db = RacingDb()
        with self.assertRaisesRegex(ValueError, '^Persisted content conflict$'):
            sm.save(db, value)
        self.assertEqual(db.rows[value['id']], '{}')
        self.assertEqual(db.transaction_count, 1)

    def test_implicit_select_transaction_does_not_leave_insert_uncommitted(self):
        db, value = FakePsycopgDb(), record()
        self.assertEqual(sm.save(db, value), value['id'])
        self.assertEqual(db.root_commits, 1)
        self.assertEqual(db.savepoints, 0)
        self.assertEqual(db.committed[value['id']], sm.canonical(value))
        self.assertFalse(db.in_transaction)
        self.assertEqual(db.commands, ['SELECT', 'INSERT', 'SELECT'])
        self.assertEqual(sm.save(db, value), value['id'])
        self.assertEqual(db.root_commits, 2)
        self.assertEqual(db.savepoints, 0)
        self.assertEqual(db.commands[-1], 'SELECT')
        self.assertEqual(len(db.committed), 1)

    def test_malformed_projection_is_rejected_without_promotion(self):
        with self.assertRaises(ValueError):
            sm.qualify_historical_record(None)
        value = record()
        value['status'] = 'VERIFIED'
        with self.assertRaises(ValueError):
            sm.qualify_historical_record(value)

    def test_self_hash_cannot_upgrade_source_or_science(self):
        db = FakeDb()
        for status in ('reproduced', 'contradicted'):
            value = record(status, source='UNATTESTED_BUT_HASHED')
            self.assertEqual(sm.decode_record(value['id'], value), value)
            db.rows[value['id']] = sm.canonical(value)
        legacy = sm.read(db, 'BTCUSDT', 10)
        self.assertEqual(set(legacy), {'schema', 'symbol', 'records'})
        self.assertEqual(legacy['schema'], sm.LIST)
        response = sm.qualify_historical_list(legacy)
        self.assertEqual(len(response['records']), 2)
        self.assertEqual({q['descriptive_outcome'] for q in response['qualifications']},
                         {'reproduced', 'contradicted'})
        for q in response['qualifications']:
            self.assertEqual(q['source_authenticity'], 'UNATTESTED')
            self.assertEqual(q['fit_binding'], 'NOT_PROVIDED')
            self.assertEqual(q['empirical_reproduction'], 'UNKNOWN')
            self.assertEqual(q['formal_proof'], 'NOT_ESTABLISHED')
            self.assertFalse(q['execution_authority'])
            self.assertFalse(q['trading_authorized'])

    def test_legacy_v1_read_shape_and_opt_in_sidecar(self):
        db, value = FakeDb(), record()
        db.rows[value['id']] = sm.canonical(value)
        v1 = sm.read(db, 'BTCUSDT', 10)
        self.assertEqual(set(v1), {'schema', 'symbol', 'records'})
        self.assertEqual(v1['records'], [value])
        qualified = sm.read_qualified(db, 'BTCUSDT', 10)
        self.assertEqual(qualified['schema'], sm.LIST)
        self.assertEqual(qualified['qualification_schema'], 'math.scientific-memory.qualification.v2')
        self.assertEqual(qualified['records'], v1['records'])
        self.assertEqual(len(qualified['qualifications']), 1)
        self.assertEqual(set(qualified['qualifications'][0]), {
            'id', 'descriptive_outcome', 'source_authenticity', 'fit_binding',
            'method_validation', 'empirical_reproduction', 'formal_proof',
            'causal_eligibility', 'execution_authority', 'trading_authorized'})
        self.assertEqual(qualified['qualifications'][0]['id'], value['id'])
        self.assertEqual(db.commands, ['SELECT', 'SELECT'])
        self.assertEqual(db.transaction_count, 0)

    def test_sidecar_refuses_forged_legacy_list_shape(self):
        value = record()
        samples = [
            {'schema': sm.LIST, 'symbol': 'ETHUSDT', 'records': [value]},
            {'schema': sm.LIST, 'symbol': 'BTCUSDT', 'records': [value], 'trusted': True},
            {'schema': 'unknown', 'symbol': 'BTCUSDT', 'records': [value]},
            {'schema': sm.LIST, 'symbol': 'BTCUSDT', 'records': [dict(value, status='VERIFIED')]},
        ]
        for sample in samples:
            with self.subTest(sample=sample['schema']):
                with self.assertRaises(ValueError):
                    sm.qualify_historical_list(sample)

    def test_read_refuses_noncanonical_bytes_same_identity(self):
        db, value = FakeDb(), record()
        original = sm.canonical(value)
        db.rows[value['id']] = original.replace(',', ', ', 1)
        self.assertNotEqual(db.rows[value['id']], original)
        with self.assertRaisesRegex(ValueError, 'noncanonical bytes'):
            sm.read(db, 'BTCUSDT', 10)
        self.assertEqual(db.commands, ['SELECT'])
        self.assertEqual(db.transaction_count, 0)

    def test_read_refuses_duplicate_decoded_json_key_even_if_self_hash_matches(self):
        db, value = FakeDb(), record()
        payload = sm.canonical(value)
        db.rows[value['id']] = payload.replace('\"symbol\":', '\"symbol\":\"BTCUSDT\",\"symbol\":', 1)
        with self.assertRaisesRegex(ValueError, 'noncanonical bytes'):
            sm.read(db, 'BTCUSDT', 10)
        self.assertEqual(db.rows[value['id']], payload.replace('\"symbol\":', '\"symbol\":\"BTCUSDT\",\"symbol\":', 1))

    def test_sidecar_refuses_duplicate_original_ids(self):
        value = record()
        response = {'schema': sm.LIST, 'symbol': value['symbol'],
                    'records': [value, value]}
        with self.assertRaisesRegex(ValueError, 'Duplicate historical memory identity'):
            sm.qualify_historical_list(response)

    def test_constant_deltas_reject_undefined_acf_before_numeric_kernel(self):
        rows = [[str(i * 60000), str(p), str(p), str(p), str(p), '1', '1']
                for i, p in reversed(list(enumerate((100, 101, 102, 103, 104), start=1)))]
        with self.assertRaisesRegex(ValueError, 'Undefined normalized autocorrelation'):
            sm.build_record('BTCUSDT', rows, sm.digest(rows), 'at_most', '-0.1')

    def test_exact_nonconstant_delta_control_remains_defined(self):
        from fractions import Fraction
        self.assertEqual(sm.exact_acf(['1', '2', '3'], 2),
                         [Fraction(1), Fraction(0), Fraction(-1, 2)])

    def test_forged_positive_authority_flags_refused_even_with_valid_self_hash(self):
        for override in ({'execution_authority': True},
                         {'trading_authorized': True},
                         {'execution_authority': None}):
            value = record()
            value['provenance'].update(override)
            value['id'] = sm.digest({key: val for key, val in value.items() if key != 'id'})
            self.assertEqual(sm.decode_record(value['id'], value), value)
            with self.assertRaisesRegex(ValueError, 'Untrusted historical authority claim'):
                sm.qualify_historical_record(value)

    def test_save_rejects_self_hashed_positive_or_missing_authority_before_sql(self):
        # R14 regression: the prior save() accepted self-consistent forged
        # records even though the later read-side projection rejected them.
        alterations = (
            {'execution_authority': True},
            {'trading_authorized': True},
            {'execution_authority': 0},
            {'trading_authorized': None},
            {'execution_authority': 'false'},
        )
        for delta in alterations:
            with self.subTest(delta=delta):
                value = record()
                value['provenance'].update(delta)
                value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
                db = FakeDb()
                with self.assertRaisesRegex(ValueError, 'Untrusted historical authority claim'):
                    sm.save(db, value)
                self.assertEqual(db.commands, [])
                self.assertEqual(db.transaction_count, 0)
                self.assertEqual(db.rows, {})
        for key in ('execution_authority', 'trading_authorized'):
            with self.subTest(missing=key):
                value = record()
                del value['provenance'][key]
                value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
                db = FakeDb()
                with self.assertRaisesRegex(ValueError, 'Untrusted historical authority claim'):
                    sm.save(db, value)
                self.assertEqual(db.commands, [])
                self.assertEqual(db.transaction_count, 0)
        value = record()
        del value['provenance']
        value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
        db = FakeDb()
        with self.assertRaisesRegex(ValueError, 'Untrusted historical authority claim'):
            sm.save(db, value)
        self.assertEqual(db.commands, [])
        self.assertEqual(db.transaction_count, 0)

    def test_save_preserves_exact_original_bytes_and_replay_for_valid_record(self):
        db, value = FakeDb(), record(status='contradicted')
        original = sm.canonical(value)
        original_id = value['id']
        self.assertEqual(sm.save(db, value), original_id)
        self.assertEqual(db.rows[original_id], original)
        self.assertEqual(sm.save(db, value), original_id)
        self.assertEqual(db.rows[original_id], original)
        self.assertEqual(db.commands, ['SELECT', 'INSERT', 'SELECT', 'SELECT'])
        self.assertEqual(len(db.rows), 1)

    def test_poisoned_historical_rows_refuse_without_cleanup_or_rewrite(self):
        db, value = FakeDb(), record()
        value['provenance']['execution_authority'] = True
        value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
        original = sm.canonical(value)
        db.rows[value['id']] = original
        response = sm.read(db, value['symbol'], 10)
        self.assertEqual(response['records'], [value])
        with self.assertRaisesRegex(ValueError, 'Untrusted historical authority claim'):
            sm.read_qualified(db, value['symbol'], 10)
        self.assertEqual(db.rows[value['id']], original)
        self.assertTrue(all(command == 'SELECT' for command in db.commands))

    def test_root_flags_positive_nonliteral_refused_before_transaction_and_sql(self):
        # R17: root authority claims were accepted by the prior source even
        # when nested provenance was strictly negative. A self-hash is not
        # privileged evidence and must not cross the SQL boundary.
        bad = (True, 1, 0, None, 'false', [], {}, 'VERIFIED')
        for flag in ('execution_authority', 'trading_authorized'):
            for claim in bad:
                with self.subTest(flag=flag, claim=repr(claim)):
                    value = record()
                    value[flag] = claim
                    value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
                    self.assertEqual(sm.decode_record(value['id'], value), value)
                    db = FakeDb()
                    with self.assertRaisesRegex(ValueError, 'Untrusted historical authority claim'):
                        sm.save(db, value)
                    self.assertEqual(db.commands, [])
                    self.assertEqual(db.transaction_count, 0)
                    self.assertEqual(db.rows, {})

    def test_root_flags_absent_and_literal_false_preserve_original_payload(self):
        for flags in ({}, {'execution_authority': False},
                      {'trading_authorized': False},
                      {'execution_authority': False, 'trading_authorized': False}):
            for status in ('reproduced', 'contradicted'):
                with self.subTest(flags=flags, status=status):
                    value = record(status=status)
                    value.update(flags)
                    value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
                    original = sm.canonical(value)
                    db = FakeDb()
                    self.assertEqual(sm.save(db, value), value['id'])
                    self.assertEqual(db.rows[value['id']], original)
                    self.assertEqual(sm.save(db, value), value['id'])
                    self.assertEqual(db.rows[value['id']], original)
                    qualified = sm.read_qualified(db, 'BTCUSDT', 10)
                    self.assertEqual(qualified['records'], [value])
                    self.assertEqual(qualified['qualifications'][0]['execution_authority'], False)
                    self.assertEqual(qualified['qualifications'][0]['trading_authorized'], False)

    def test_poisoned_root_historical_row_refused_without_purge_or_update(self):
        for flag in ('execution_authority', 'trading_authorized'):
            with self.subTest(flag=flag):
                db, value = FakeDb(), record()
                value[flag] = True
                value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
                payload = sm.canonical(value)
                db.rows[value['id']] = payload
                # Legacy v1 read keeps its old shape, while sidecar refuses.
                legacy = sm.read(db, 'BTCUSDT', 10)
                self.assertEqual(set(legacy), {'schema', 'symbol', 'records'})
                self.assertEqual(legacy['records'], [value])
                with self.assertRaisesRegex(ValueError, 'Untrusted historical authority claim'):
                    sm.read_qualified(db, 'BTCUSDT', 10)
                self.assertEqual(db.rows[value['id']], payload)
                self.assertTrue(all(command == 'SELECT' for command in db.commands))

    def test_projection_does_not_change_stored_hash_or_payload(self):
        value = record()
        before = sm.canonical(value)
        receipt = sm.qualify_historical_record(value)
        self.assertEqual(sm.canonical(value), before)
        self.assertEqual(value['id'], sm.digest({key: val for key, val in value.items() if key != 'id'}))
        self.assertEqual(receipt['id'], value['id'])
        self.assertEqual(receipt['causal_eligibility'], 'UNKNOWN')


if __name__ == '__main__':
    unittest.main()
