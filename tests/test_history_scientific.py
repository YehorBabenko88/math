"""Real stdio integration: both engines execute from this source checkout."""
import copy
import json
import pathlib
import shutil
import subprocess
import sys
import unittest
from test_history_timed import request

ROOT = pathlib.Path(__file__).resolve().parents[1]


def joint_request():
    def edge(a, b, port='x'):
        return {'from': {'node': a, 'port': 'value'}, 'to': {'node': b, 'port': port}}
    return {'schema': 'math.history.scientific.request.v1', 'history': request(),
            'graph': {'nodes': [
                {'id': 'formula', 'kind': 'formula', 'expression': 'x*2', 'outputUnit': 'USDT/BTC'},
                {'id': 'model_a', 'kind': 'model', 'model': 'affine', 'parameters': {'gain': 2, 'offset': 0}},
                {'id': 'model_b', 'kind': 'model', 'model': 'affine', 'parameters': {'gain': 3, 'offset': 0}},
                {'id': 'combination', 'kind': 'sum'}, {'id': 'comparison', 'kind': 'compare'}],
                'edges': [edge('history', 'formula'), edge('history', 'model_a'), edge('history', 'model_b'),
                          edge('model_a', 'combination', 'a'), edge('model_b', 'combination', 'b'),
                          edge('formula', 'comparison', 'a'), edge('model_a', 'comparison', 'b')],
                'outputs': [{'node': 'formula', 'port': 'value'}, {'node': 'combination', 'port': 'value'},
                            {'node': 'comparison', 'port': 'mae'}]}}


def run(q):
    return subprocess.run([sys.executable, '-I', '-S', str(ROOT / 'python/history_scientific_worker.py'),
                           shutil.which('node')], input=json.dumps(q).encode(), capture_output=True, timeout=15)


class JointContract(unittest.TestCase):
    def test_real_composition_preserves_clocks_and_forecast_parity(self):
        q = joint_request()
        q['history']['rows'][-1]['available_at_ms'] += 500
        q['history']['decision_ms'] += 500
        r = run(q)
        self.assertEqual(r.returncode, 0, r.stderr.decode())
        out = json.loads(r.stdout)
        self.assertEqual(out['schema'], 'math.history.scientific.result.v1')
        self.assertEqual(out['scientific']['outputs'][0]['values'][:3], [202, 202.2, 202.4])
        for actual, expected in zip(out['scientific']['outputs'][1]['values'][:3], [505, 505.5, 506]):
            self.assertAlmostEqual(actual, expected, places=12)
        self.assertEqual(out['scientific']['outputs'][2]['values'], [0])
        self.assertEqual(out['scientific']['outputs'][0]['timestamps'][-1], 2400000)
        self.assertEqual(out['scientific']['outputs'][0]['availableAt'][-1], 2400500)
        self.assertEqual(out['history']['forecast_target_event_end_ms'], 2460000)
        self.assertEqual(out['history']['dataset_id'], 'c' * 64)
        self.assertEqual(out['provenance']['rows'], q['history']['rows'])
        self.assertFalse(out['trading_authorized'])

    def test_injected_source_stale_incomplete_future_train_and_model_reject(self):
        changes = [lambda q: q['graph']['nodes'].append({'id': 'evil', 'kind': 'source'}),
                   lambda q: q['history']['rows'][0].update(available_at_ms=999999999),
                   lambda q: q['history']['rows'][0].update(watermark_ms=0),
                   lambda q: q['history'].update(decision_ms=2460001),
                   lambda q: q['history'].update(train_end_ms=60000),
                   lambda q: q['history'].update(model_version='forged'),
                   lambda q: q['history']['source'].update(source_revision='wrong'),
                   lambda q: q['history']['rows'][0].update(source_receipt_hash='wrong')]
        for change in changes:
            q = joint_request(); change(q)
            with self.subTest(change=change):
                r = run(q)
                self.assertNotEqual(r.returncode, 0)
                self.assertEqual(r.stdout, b'')

    def test_prefix_result_unchanged_when_unseen_suffix_changes(self):
        q = joint_request()
        q['history']['rows'] = q['history']['rows'][:30]
        q['history']['decision_ms'] = 1800000
        r = run(q)
        self.assertEqual(r.returncode, 0, r.stderr.decode())
        # Different later dataset snapshots share the same independently bound prefix.
        other = copy.deepcopy(q); other['history']['dataset_fingerprint'] = 'e' * 64
        r2 = run(other)
        self.assertEqual(r2.returncode, 0, r2.stderr.decode())
        a, b = json.loads(r.stdout), json.loads(r2.stdout)
        self.assertEqual(a['scientific'], b['scientific'])
        self.assertEqual(a['history']['forecast'], b['history']['forecast'])
