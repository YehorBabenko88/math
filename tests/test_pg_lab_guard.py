import importlib.util
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
from pg_lab_guard import lab_config, lab_environment, checked_conninfo

ENV = {'MATH_PG_LAB_APPROVAL': 'MASTER_APPROVED_DISPOSABLE_PG18_25432', 'MATH_PG_LAB_SYSTEM_ID': '1234567890123456789'}
ROLE = 'memory_lab'
URL = 'postgresql://memory_lab:fixture-only@127.0.0.1:25432/scientific_memory_test'

class LabGuard(unittest.TestCase):
    def test_explicit_config(self):
        self.assertEqual(lab_config(URL, ROLE, ENV), dict(host='127.0.0.1', hostaddr='127.0.0.1', port=25432, dbname='scientific_memory_test', user=ROLE, password='fixture-only', sslmode='disable', gssencmode='disable', connect_timeout=3))
    def test_hostile_urls(self):
        for url in (URL.replace('postgresql:', 'postgres:'), URL+'?host=example.invalid', URL+'?dbname=postgres', URL+'?user=lab', URL+'?port=5432', URL+'?', URL+'#x', URL+'#', URL.replace('25432','5432'), URL.replace('127.0.0.1','localhost'), URL.replace('127.0.0.1','%31%32%37.0.0.1'), URL.replace('fixture-only','fixture%2donly'), URL.replace('/scientific_memory_test','/postgres'), URL.replace(ROLE,'lab'), URL+'\n'):
            with self.subTest(url=url), self.assertRaisesRegex(ValueError,'PG_LAB_REFUSED'):
                lab_config(url, ROLE, ENV)
    def test_environment(self):
        for key in ('PGHOST','PGPORT','PGUSER','PGDATABASE','PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGPASSFILE','pgsslmode','NODE_PG_FORCE_NATIVE'):
            with self.subTest(key=key), self.assertRaisesRegex(ValueError,'PG_LAB_REFUSED'):
                lab_environment({**ENV,key:'override'})
    def test_approval_and_identity(self):
        for env in ({},{**ENV,'MATH_PG_LAB_APPROVAL':'yes'},{**ENV,'MATH_PG_LAB_SYSTEM_ID':'0'},{**ENV,'MATH_PG_LAB_SYSTEM_ID':'18446744073709551616'}):
            with self.subTest(env=env), self.assertRaisesRegex(ValueError,'PG_LAB_REFUSED'):
                lab_environment(env)
    @unittest.skipUnless(importlib.util.find_spec('psycopg'), 'psycopg unavailable')
    def test_actual_libpq_parser_no_connection(self):
        import psycopg
        from psycopg.conninfo import conninfo_to_dict
        with patch.dict(os.environ, ENV, clear=True):
            info=conninfo_to_dict(checked_conninfo(psycopg, URL, ROLE))
            self.assertEqual((info['host'],info['hostaddr'],info['port'],info['user']),('127.0.0.1','127.0.0.1','25432',ROLE))
            with self.assertRaisesRegex(ValueError,'PG_LAB_REFUSED'):
                checked_conninfo(psycopg, URL+'?host=example.invalid', ROLE)

if __name__ == '__main__':
    unittest.main()
