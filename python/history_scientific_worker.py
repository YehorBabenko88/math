"""Bounded joint historical v1.1 / scientific v2.1 worker from one source tree.

Argument 1 is the operator-pinned Node executable, never an input JSON command.
The caller must independently admit the Grid envelope and pin this entire source.
"""
import json
from pathlib import Path
import subprocess
import sys

# -I excludes the script directory; import only this committed sibling directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from history_contract import evaluate_timed_request, digest
from history_worker import canonical

LIMIT = 2 * 1024 * 1024


def evaluate_joint(q, node):
    if (type(q) is not dict or set(q) != {'schema', 'history', 'graph'} or
            q['schema'] != 'math.history.scientific.request.v1'):
        raise ValueError('JOINT_SCHEMA')
    history = evaluate_timed_request(q['history'])
    h, g = q['history'], q['graph']
    if history['forecast_target_event_end_ms'] <= h['decision_ms']:
        raise ValueError('HORIZON_ALREADY_KNOWN')
    if (type(g) is not dict or set(g) != {'nodes', 'edges', 'outputs'} or
            type(g['nodes']) is not list or any(type(n) is not dict or
            n.get('kind') == 'source' or n.get('id') == 'history' for n in g['nodes'])):
        raise ValueError('EXTERNAL_SOURCE_DENIED')
    rows = h['rows']
    # Event end, first availability and source event bounds remain different clocks.
    source = {'id': 'history', 'kind': 'source', 'type': 'series',
              'unit': h['units']['price'], 'values': [r['close'] for r in rows],
              'timestamps': [r['event_end_ms'] for r in rows],
              'availableAt': [r['available_at_ms'] for r in rows],
              'provenance': {'sourceId': h['source']['identity'],
                             'version': h['source']['source_revision'],
                             'sha256': history['prefix_digest']}}
    graph = {'schema': 'math.scientific.graph.v2', 'mode': 'HISTORICAL_RESEARCH',
             'execution_authority': False, 'asOf': h['decision_ms'],
             'nodes': [source] + g['nodes'], 'edges': g['edges'], 'outputs': g['outputs']}
    raw = canonical(graph)
    if len(raw) > 262144:
        raise ValueError('GRAPH_LIMIT')
    runner = Path(__file__).resolve().parents[1] / 'scripts/history/scientific-stdio.mjs'
    p = subprocess.run([node, '--max-old-space-size=128', str(runner)], input=raw,
                       capture_output=True, timeout=8)
    if p.returncode or len(p.stdout) > LIMIT:
        raise ValueError('SCIENTIFIC_FAILED')
    scientific = json.loads(p.stdout)
    result = {'schema': 'math.history.scientific.result.v1', 'api_revision': 'history-1.1+scientific-2.1',
              'request_digest': digest(q), 'history': history, 'scientific': scientific,
              'provenance': {k: h[k] for k in ('dataset_id', 'dataset_fingerprint', 'source',
                              'market', 'units', 'decision_ms', 'rows')},
              'source_authenticity': 'NOT_EVALUATED_BY_MATH', 'training_authorized': False,
              'execution_authority': False, 'trading_authorized': False}
    if len(canonical(result)) > 2 * LIMIT:
        raise ValueError('RESULT_LIMIT')
    return result


def main():
    try:
        raw = sys.stdin.buffer.read(LIMIT + 1)
        if len(raw) > LIMIT or len(sys.argv) != 2:
            raise ValueError('INPUT_LIMIT')
        result = evaluate_joint(json.loads(raw), sys.argv[1])
        sys.stdout.buffer.write(canonical(result))
    except (ValueError, TypeError, KeyError, OSError, OverflowError, subprocess.SubprocessError):
        sys.stderr.write('JOINT_REQUEST_REJECTED\n')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
