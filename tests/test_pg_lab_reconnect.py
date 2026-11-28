"""Offline tests: real libpq parser and simulated connection lifecycle, never a socket."""
import ctypes as C
import ctypes.util
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
import pg_lab_guard as guard

ENV = {'MATH_PG_LAB_APPROVAL': guard.APPROVAL, 'MATH_PG_LAB_SYSTEM_ID': '1234567890123456789'}
ROLE = 'memory_lab'
URL = 'postgresql://memory_lab:fixture-only@127.0.0.1:25432/scientific_memory_test'
GOOD = ('scientific_memory_test', ROLE, ROLE, 180007, '127.0.0.1', 25432, ENV['MATH_PG_LAB_SYSTEM_ID'], False)

class Option(C.Structure):
    _fields_ = [(x,C.c_char_p) for x in ('keyword','envvar','compiled','val','label','dispchar')] + [('dispsize',C.c_int)]

@unittest.skipUnless(ctypes.util.find_library('pq'), 'system libpq unavailable')
class ActualLibpq(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lib = C.CDLL(ctypes.util.find_library('pq'))
        cls.lib.PQlibVersion.restype = C.c_int
        cls.lib.PQconninfoParse.argtypes = [C.c_char_p,C.POINTER(C.c_char_p)]
        cls.lib.PQconninfoParse.restype = C.POINTER(Option)
        cls.lib.PQconninfoFree.argtypes = [C.POINTER(Option)]
        cls.lib.PQfreemem.argtypes = [C.c_void_p]
        print('actual libpq version',cls.lib.PQlibVersion())
    def parse(self, raw):
        err = C.c_char_p()
        ptr = self.lib.PQconninfoParse(raw.encode('ascii'),C.byref(err))
        if not ptr:
            msg = err.value
            if err: self.lib.PQfreemem(err)
            self.fail(str(msg))
        try:
            result = {}
            i = 0
            while ptr[i].keyword:
                if ptr[i].val is not None: result[ptr[i].keyword.decode()] = ptr[i].val.decode()
                i += 1
            return result
        finally: self.lib.PQconninfoFree(ptr)
    def test_explicit_config_real_libpq(self):
        cfg=guard.lab_config(URL,ROLE,ENV)
        # Fixture grammar permits no quotes, spaces or backslashes. This is NOT psycopg.make_conninfo.
        parsed=self.parse(' '.join(f'{k}={v}' for k,v in cfg.items()))
        self.assertEqual(parsed,{k:str(v) for k,v in cfg.items()})
    def test_query_override_denied_before_parser(self):
        for tail,key,value in [('host=192.0.2.1','host','192.0.2.1'),('hostaddr=192.0.2.2','hostaddr','192.0.2.2'),('port=5432','port','5432'),('dbname=other','dbname','other'),('user=other','user','other'),('service=other','service','other')]:
            bad=URL+'?'+tail
            with self.subTest(key=key):
                self.assertEqual(self.parse(bad)[key],value)
                with self.assertRaisesRegex(ValueError,'PG_LAB_REFUSED'): guard.lab_config(bad,ROLE,ENV)

class Connection:
    def __init__(self,row,fail_set=False): self.row=row;self.calls=[];self.closed=False;self.autocommit=True;self.fail_set=fail_set
    def execute(self,sql):
        self.calls.append(sql)
        if self.fail_set and sql.startswith('SET '): raise RuntimeError('session setup failed')
        return self
    def fetchone(self): return self.row
    def close(self): self.closed=True
class Driver:
    def __init__(self,*connections): self.connections=iter(connections);self.calls=[]
    def connect(self,**kwargs): self.calls.append(kwargs);return next(self.connections)

class Reconnect(unittest.TestCase):
    def setUp(self):
        self.addCleanup(patch.stopall)
        patch.dict(os.environ,ENV,clear=True).start()
        # Deliberate seam simulation, not a real psycopg parser or transport.
        patch.object(guard,'checked_conninfo',return_value='simulated-parser').start()
    def test_every_reconnect_identity_checked(self):
        a,b=Connection(GOOD),Connection((*GOOD[:6],'999',False))
        driver=Driver(a,b)
        self.assertIs(guard.connect_readonly_lab(driver,URL,ROLE),a)
        self.assertEqual(a.calls[1:],['SET default_transaction_read_only = on','SET statement_timeout = 3000'])
        self.assertFalse(a.autocommit)
        with self.assertRaisesRegex(ValueError,'PG_LAB_REFUSED'): guard.connect_readonly_lab(driver,URL,ROLE)
        self.assertEqual(len(driver.calls),2);self.assertEqual(len(b.calls),1);self.assertTrue(b.closed)
    def test_session_setup_failure_closes(self):
        c=Connection(GOOD,True)
        with self.assertRaisesRegex(ValueError,'PG_LAB_REFUSED'): guard.connect_readonly_lab(Driver(c),URL,ROLE)
        self.assertTrue(c.closed)
    def test_hostile_environment_after_first_open(self):
        a=Connection(GOOD);driver=Driver(a)
        guard.connect_readonly_lab(driver,URL,ROLE)
        with patch.dict(os.environ,{'PGHOSTADDR':'192.0.2.1'}):
            with self.assertRaisesRegex(ValueError,'PG_LAB_REFUSED'): guard.connect_readonly_lab(driver,URL,ROLE)
        self.assertEqual(len(driver.calls),1)

if __name__=='__main__': unittest.main(verbosity=2)
