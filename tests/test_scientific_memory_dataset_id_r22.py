"""P22 independent RED/GREEN contract: Codex exact SHA, fake DB only.

No PostgreSQL, trading, external HTTP or numerical engine executed.
"""
import unittest
from tests.test_scientific_memory_r09_negative import FakeDb, record, sm


def identity(value):
    result = record()
    result['dataset']['id'] = value
    result['id'] = sm.digest({k: v for k, v in result.items() if k != 'id'})
    return result


class CodexDatasetIdentityIndependent(unittest.TestCase):
    def test_negative_nested_authority_pre_sql(self):
        value = identity('a' * 64)
        value['evidence'] = [{'nested': {'trading_authorized': True}}]
        value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
        db = FakeDb()
        with self.assertRaisesRegex(ValueError, 'Untrusted historical authority claim'):
            sm.save(db, value)
        self.assertEqual(db.commands, [])
        self.assertEqual(db.transaction_count, 0)

    def test_literal_false_canonical_bytes_and_replay(self):
        value = identity('a' * 64)
        value['execution_authority'] = False
        value['trading_authorized'] = False
        value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
        db = FakeDb()
        self.assertEqual(sm.save(db, value), value['id'])
        original = sm.canonical(value)
        self.assertEqual(db.rows[value['id']], original)
        self.assertEqual(sm.save(db, value), value['id'])
        self.assertEqual(db.commands, ['SELECT', 'INSERT', 'SELECT', 'SELECT'])
        self.assertEqual(db.rows[value['id']], original)

    def test_nested_nonliteral_zero_pre_sql(self):
        value = identity('a' * 64)
        value['metadata'] = [{'execution_authority': 0}]
        value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
        db = FakeDb()
        with self.assertRaisesRegex(ValueError, 'Untrusted historical authority claim'):
            sm.save(db, value)
        self.assertEqual(db.commands, [])

    def test_legacy_read_shape_and_bytes_unmodified_for_bad_dataset_id(self):
        value = identity('bad-id')
        db = FakeDb()
        payload = sm.canonical(value)
        db.rows[value['id']] = payload  # already-persisted legacy row, never mutate
        legacy = sm.read(db, 'BTCUSDT', 20)
        self.assertEqual(set(legacy), {'schema','symbol','records'})
        self.assertEqual(legacy['records'], [value])
        self.assertEqual(db.rows[value['id']], payload)

    def test_save_refuses_malformed_dataset_id_before_any_sql(self):
        bad_values = ('invalid-id', 'A' * 64, None, 0)
        for bad in bad_values:
            with self.subTest(dataset_id=repr(bad)):
                value = identity(bad)
                db = FakeDb()
                with self.assertRaisesRegex(ValueError, 'Invalid historical dataset identity'):
                    sm.save(db, value)
                self.assertEqual(db.commands, [])
                self.assertEqual(db.transaction_count, 0)
        # Presence is also mandatory for the S reader.
        value = identity('a' * 64)
        del value['dataset']['id']
        value['id'] = sm.digest({k: v for k, v in value.items() if k != 'id'})
        db = FakeDb()
        with self.assertRaisesRegex(ValueError, 'Invalid historical dataset identity'):
            sm.save(db, value)
        self.assertEqual(db.commands, [])
        self.assertEqual(db.transaction_count, 0)

    def test_qualified_read_refuses_bad_historical_id_no_rewrite(self):
        value = identity('bad-id')
        db = FakeDb()
        payload = sm.canonical(value)
        db.rows[value['id']] = payload
        with self.assertRaisesRegex(ValueError, 'Invalid historical dataset identity'):
            sm.read_qualified(db, 'BTCUSDT', 20)
        self.assertEqual(db.rows[value['id']], payload)
        self.assertTrue(all(c == 'SELECT' for c in db.commands))

    def test_qualified_positive_control_is_deny_only(self):
        value = identity('a' * 64)
        db = FakeDb()
        sm.save(db, value)
        result = sm.read_qualified(db, 'BTCUSDT', 20)
        self.assertEqual(result['records'], [value])
        self.assertFalse(result['qualifications'][0]['execution_authority'])
        self.assertFalse(result['qualifications'][0]['trading_authorized'])
        self.assertEqual(result['qualifications'][0]['source_authenticity'], 'UNATTESTED')


if __name__ == '__main__':
    unittest.main()
