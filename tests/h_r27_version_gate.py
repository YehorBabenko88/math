"""H R27 strict source-version test selector, not a production engine.

This gate preserves the exact historical H R23 test bytes. For the original
Codex/X10 engine it runs all eight historical H tests; for the A2 engine it
runs the seven unchanged historical H tests plus the five separate versioned
A2 status tests. Unknown sources/ref drift fail closed before any execution.
"""
import hashlib
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / 'python' / 'math_universe_research_engine.py'
OLD_TEST = ROOT / 'tests' / 'test_h_r23_full_integration.py'
A2_TEST = ROOT / 'tests' / 'test_h_r26_a2_status.py'

OLD_ENGINE_SHA = 'bbe2dedf04e31a28766264c284c827f1d806d117'
A2_ENGINE_SHA = '27d596252fca268dfb27526de695ce604e00ea16'
OLD_TEST_SHA = 'a534e1d1626e3f018743eb95d6277402c10b4c8b'
A2_TEST_SHA = '86368189756f18bcfef9f4e3357c1e5f0399ace5'
HISTORIC_ZERO_TEST = 'test_4d_zero_direction_no_trajectory_but_descriptive_stats'


def blob_sha(path):
    data = path.read_bytes()
    return hashlib.sha1(b'blob ' + str(len(data)).encode('ascii') + b'\x00' + data).hexdigest()


def main():
    observed = blob_sha(ENGINE)
    if observed not in (OLD_ENGINE_SHA, A2_ENGINE_SHA):
        raise SystemExit('UNKNOWN_ENGINE_BLOB_FAIL_CLOSED: ' + observed)
    if blob_sha(OLD_TEST) != OLD_TEST_SHA:
        raise SystemExit('HISTORICAL_TEST_BYTES_CHANGED')
    if observed == A2_ENGINE_SHA and (not A2_TEST.exists() or blob_sha(A2_TEST) != A2_TEST_SHA):
        raise SystemExit('A2_TEST_MISSING_OR_MODIFIED')

    sys.path[:0] = [str(ROOT / 'python'), str(ROOT / 'tests')]
    from test_h_r23_full_integration import FullExactCodexIntegration

    suite = unittest.TestSuite()
    names = unittest.defaultTestLoader.getTestCaseNames(FullExactCodexIntegration)
    if len(names) != 8 or HISTORIC_ZERO_TEST not in names:
        raise SystemExit('HISTORICAL_TEST_ROSTER_CHANGED')
    for name in names:
        if observed == A2_ENGINE_SHA and name == HISTORIC_ZERO_TEST:
            # The identical legacy test remains unchanged and immutable.
            # Its *old* asserted geometry=True is invalid for A2; replace
            # this one case with the stricter A2 suite below, never weaken.
            continue
        suite.addTest(FullExactCodexIntegration(name))

    if observed == A2_ENGINE_SHA:
        from test_h_r26_a2_status import A2VersionedStatusAcceptance
        new_names = unittest.defaultTestLoader.getTestCaseNames(A2VersionedStatusAcceptance)
        if len(new_names) != 5 or 'test_zero_direction_4d_normalization_true_trajectory_false' not in new_names:
            raise SystemExit('A2_TEST_ROSTER_CHANGED')
        for name in new_names:
            suite.addTest(A2VersionedStatusAcceptance(name))

    expected = 8 if observed == OLD_ENGINE_SHA else 12
    if suite.countTestCases() != expected:
        raise SystemExit('H_TEST_COUNT_MISMATCH')
    print('H_GATE_ENGINE=' + ('CODEX_X10' if observed == OLD_ENGINE_SHA else 'A2'))
    print('H_GATE_TESTS=' + str(expected))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    sys.exit(main())
