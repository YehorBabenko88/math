"""Scientific-memory negative test imports must not poison numeric modules."""
from pathlib import Path
import subprocess
import sys
import unittest


class TestModuleIsolation(unittest.TestCase):
    def test_negative_memory_import_restores_numerical_modules(self):
        root = Path(__file__).resolve().parents[1]
        code = """import sys
from pathlib import Path
root=Path.cwd()
sys.path[:0]=[str(root/'python'),str(root/'tests')]
import history_statistics as before
import test_scientific_memory_r09_negative
import history_statistics as after
assert after is before, 'negative tests replaced the canonical module'
assert callable(after.numeric_sample_summary)
"""
        process = subprocess.run([sys.executable, '-I', '-B', '-c', code], cwd=root,
                                 capture_output=True, text=True, timeout=15)
        self.assertEqual(process.returncode, 0, process.stderr)
