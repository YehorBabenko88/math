"""Qualification must refuse a different/dirty HEAD and hash both languages."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class QualificationGuard(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ('scripts', 'tests', 'src'): (self.root / name).mkdir()
        shutil.copyfile(ROOT / 'scripts/history_ci.py', self.root / 'scripts/history_ci.py')
        (self.root / 'tests/test_ok.py').write_text('import unittest\nclass T(unittest.TestCase):\n def test_ok(self): self.assertEqual(2+2,4)\n')
        (self.root / 'src/engine.mjs').write_text('export const value=4;\n')
        def git(*a): return subprocess.check_output(['git', '-C', str(self.root), *a], stderr=subprocess.DEVNULL).decode().strip()
        self.git = git
        git('init'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
        git('add', '.'); git('commit', '-m', 'fixture'); self.head = git('rev-parse', 'HEAD')

    def run_ci(self, expected=None):
        return subprocess.run([sys.executable, str(self.root / 'scripts/history_ci.py'), 'tests', 'test_ok.py'],
            cwd=self.root, env={**os.environ, 'EXPECTED_SOURCE_SHA': expected or self.head},
            capture_output=True, timeout=20)

    def test_wrong_expected_head_rejects(self):
        self.assertNotEqual(self.run_ci('0' * 40).returncode, 0)

    def test_dirty_tested_source_rejects(self):
        (self.root / 'src/engine.mjs').write_text('export const value=99;\n')
        self.assertNotEqual(self.run_ci().returncode, 0)

    def test_receipt_hashes_scientific_sources_alongside_python(self):
        r = self.run_ci(); self.assertEqual(r.returncode, 0, r.stderr.decode())
        receipt = json.loads((self.root / '.history-evidence/receipt.json').read_text())
        self.assertIn('src/engine.mjs', receipt['sources'])
        self.assertEqual(receipt['head'], self.head)
