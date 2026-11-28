"""Scoped Math Universe gate; historical/full-suite results remain separate."""
from pathlib import Path
import sys
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'python'), str(ROOT/'tests')]
PATTERNS = ('test_history_metric_core.py', 'test_history_spherical.py',
 'test_history_causal.py', 'test_history_pearson_contract.py',
 'test_history_graph_core.py', 'test_history_topology.py',
 'test_math_resource_budget.py', 'test_math_universe_research*.py',
 'test_scientific_memory*.py', 'test_math_research_paper.py',
 'test_round21*.py', 'test_f22_acceptance.py',
 'test_r25_g_integrated_forest.py', 'test_u_r25_*.py')
suite = unittest.TestSuite()
for pattern in PATTERNS:
    suite.addTests(unittest.defaultTestLoader.discover(str(ROOT/'tests'), pattern=pattern))


def identities(suite):
    for test in suite:
        if isinstance(test, unittest.TestSuite):
            yield from identities(test)
        else:
            yield test.id()


ids = list(identities(suite))
if len(ids) != len(set(ids)):
    raise RuntimeError('Duplicate test identity')
result = unittest.TextTestRunner(verbosity=2).run(suite)
print('UNIQUE_TEST_IDENTITIES', len(ids))
# The historical H test file stays immutable. A2 changes ZERO_DIRECTION
# semantics, so the source-pinned H gate selects the exact versioned suite.
# Never include the obsolete H test through wildcard discovery.
gate = subprocess.run([sys.executable, '-I', '-B', str(ROOT/'tests'/'h_r27_version_gate.py')],
                      cwd=ROOT, check=False, timeout=480)
print('H_VERSION_GATE_EXIT', gate.returncode)
sys.exit(not result.wasSuccessful() or gate.returncode != 0)
