"""Independent pinned-source parity; no databases, servers or external services."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
HISTORY = '3a9c542841e160f8b1924f155aaa2d1a676dfd04'
SCIENTIFIC = '1f97e56701c0fce01dc8dd05952111fa8df3f2d1'
KERNELS = ('history_timeseries.py', 'history_nonlinear.py', 'history_stochastic.py',
           'history_statistics.py', 'history_sizing.py', 'history_worker.py', 'history_timed_worker.py')


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], timeout=30)


def scientific(root):
    script = """import {pathToFileURL} from 'node:url';import {readFileSync} from 'node:fs';
const root=process.argv[1];const {executeScientificGraph}=await import(pathToFileURL(root+'/src/scientific-engine.mjs'));
process.stdout.write(JSON.stringify(executeScientificGraph(JSON.parse(readFileSync(root+'/examples/scientific-composition.v21.json')))));"""
    return subprocess.check_output([shutil.which('node'), '--input-type=module', '-e', script, str(root)], timeout=15)


def main():
    kernels = {}
    for name in KERNELS:
        path = 'python/' + name
        old, new = git('show', HISTORY + ':' + path), git('show', 'HEAD:' + path)
        if old != new: raise ValueError('HISTORICAL_KERNEL_SOURCE_MISMATCH:' + path)
        kernels[path] = hashlib.sha256(new).hexdigest()
    with tempfile.TemporaryDirectory(prefix='math-scientific-parity-') as temp:
        archive = git('archive', SCIENTIFIC, '--', 'src', 'examples')
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(temp, filter='data')
        before = scientific(Path(temp))
    after = scientific(ROOT)
    if before != after: raise ValueError('SCIENTIFIC_RESULT_PARITY')
    out = ROOT / '.history-evidence'; out.mkdir(exist_ok=True)
    receipt = {'schema': 'math.history.scientific.parity.v1', 'head': git('rev-parse', 'HEAD').decode().strip(),
               'tree': git('rev-parse', 'HEAD^{tree}').decode().strip(),
               'history_reference': HISTORY, 'scientific_reference': SCIENTIFIC,
               'preserved_git_blob_sha256': kernels,
               'scientific_full_result_sha256': hashlib.sha256(after).hexdigest(),
               'status': 'PASS', 'source_authenticity': 'NOT_EVALUATED', 'trading_authorized': False}
    (out / 'parity.json').write_text(json.dumps(receipt, indent=2, sort_keys=True), encoding='utf8')
    print(json.dumps(receipt, sort_keys=True))


if __name__ == '__main__': main()
