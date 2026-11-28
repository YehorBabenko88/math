"""Real PostgreSQL 18 integration. Run only against the named disposable DB."""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import os
import sys
import unittest
from uuid import uuid4

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))

from scientific_memory import build_record, digest, read, save
from pg_lab_guard import lab_config, connect_lab


class PostgresScientificMemoryTest(unittest.TestCase):
    def test_records_survive_connection_restart_and_tampering_fails_closed(self):
        dsn = os.environ['SCIENTIFIC_MEMORY_TEST_DSN']
        lab_config(dsn, 'memory_lab')
        root = Path(__file__).resolve().parents[1]
        rows = [[str(i * 60000), str(p), str(p), str(p), str(p), '1', '1']
                for i, p in reversed(list(enumerate((10, 12, 10, 12, 10), start=1)))]
        records = [build_record('BTCUSDT', rows, digest(rows), operator, '-0.1')
                   for operator in ('at_most', 'at_least')]
        with connect_lab(psycopg, dsn, 'memory_lab') as writer:
            self.assertTrue(writer.execute('SHOW server_version').fetchone()[0].startswith('18.'))
            writer.execute((root / 'python/scientific_memory.sql').read_text())
            for record in records * 2:
                self.assertEqual(save(writer, record), record['id'])

        with connect_lab(psycopg, dsn, 'memory_lab') as reader:
            remembered = read(reader, 'BTCUSDT', 100)['records']
            self.assertEqual(sorted(remembered, key=lambda record: record['id']), sorted(records, key=lambda record: record['id']))
            self.assertEqual(read(reader, 'ETHUSDT', 100)['records'], [])
        with connect_lab(psycopg, dsn, 'memory_lab') as writer:
            for statement in ('UPDATE public.mu_scientific_runs SET payload=payload',
                              'DELETE FROM public.mu_scientific_runs',
                              'TRUNCATE public.mu_scientific_runs'):
                with self.assertRaises(psycopg.errors.ObjectNotInPrerequisiteState):
                    writer.execute(statement)
                writer.rollback()

        concurrent_record = build_record("T" + uuid4().hex[:20].upper(), rows, digest(rows), "at_most", "-0.1")

        def concurrent_save(_):
            with connect_lab(psycopg, dsn, 'memory_lab') as connection:
                return save(connection, concurrent_record)
        with ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual(list(pool.map(concurrent_save, range(24))), [concurrent_record['id']] * 24)
        rollback_record = build_record('ETHUSDT', rows, digest(rows), 'at_most', '-0.1')
        with connect_lab(psycopg, dsn, 'memory_lab') as writer:
            with self.assertRaisesRegex(RuntimeError, 'rollback probe'):
                with writer.transaction():
                    save(writer, rollback_record)
                    raise RuntimeError('rollback probe')
        with connect_lab(psycopg, dsn, 'memory_lab') as reader:
            self.assertEqual(read(reader, 'ETHUSDT', 100)['records'], [])
            self.assertEqual(reader.execute('SELECT count(*) FROM public.mu_scientific_runs WHERE id=%s', (concurrent_record['id'],)).fetchone()[0], 1)


if __name__ == '__main__':
    unittest.main()
