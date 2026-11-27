"""Real PostgreSQL 18 integration. Run only against the named disposable DB."""

from pathlib import Path
import os
import unittest
from urllib.parse import urlsplit

import psycopg

from scientific_memory import build_record, digest, read, save


class PostgresScientificMemoryTest(unittest.TestCase):
    def test_records_survive_connection_restart_and_tampering_fails_closed(self):
        dsn = os.environ['SCIENTIFIC_MEMORY_TEST_DSN']
        address = urlsplit(dsn)
        self.assertEqual((address.hostname, address.path), ('127.0.0.1', '/scientific_memory_test'))
        root = Path(__file__).resolve().parents[1]
        rows = [[str(i * 60000), str(p), str(p), str(p), str(p), '1', '1']
                for i, p in reversed(list(enumerate((10, 12, 10, 12, 10), start=1)))]
        records = [build_record('BTCUSDT', rows, digest(rows), operator, '-0.1')
                   for operator in ('at_most', 'at_least')]
        with psycopg.connect(dsn) as writer:
            self.assertTrue(writer.execute('SHOW server_version').fetchone()[0].startswith('18.'))
            writer.execute((root / 'python/scientific_memory.sql').read_text())
            for record in records * 2:
                self.assertEqual(save(writer, record), record['id'])

        with psycopg.connect(dsn) as reader:
            remembered = read(reader, 'BTCUSDT', 100)['records']
            self.assertEqual(sorted(remembered, key=lambda record: record['id']), sorted(records, key=lambda record: record['id']))
            self.assertEqual(read(reader, 'ETHUSDT', 100)['records'], [])
        with psycopg.connect(dsn) as writer:
            writer.execute('UPDATE public.mu_scientific_runs SET payload=%s WHERE id=%s', ('{}', records[0]['id']))
            with self.assertRaises(ValueError):
                read(writer, 'BTCUSDT', 100)
            writer.rollback()


if __name__ == '__main__':
    unittest.main()
