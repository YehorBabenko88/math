"""Independent pinned-source parity; no databases, servers or external services."""
import argparse
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


# Explicit source profiles; finite evidence is NOT original raw-byte parity.
ORIGINAL_KERNEL_SHA256={'python/history_timeseries.py': '0fe1848d0ba8b341c374456817f65ad4f3d86b7833bce3510d509a373b76729a', 'python/history_nonlinear.py': '1d300514b9cfcb7309dd4bb9f234d00e6dd4b28eb16e01b68f27425bbf266c9c', 'python/history_stochastic.py': 'cda119031acf375f3f7226722fe2eeccb292eaa93519a3781ad798d209cb5f65', 'python/history_statistics.py': 'c34418236c92f9cc47653efcd53a07d61ecc6b5f3de52b5ec99f8ff60f0f4ea4', 'python/history_sizing.py': 'ad050a83871842d9fa77559738dee7b71fd5ba75325bc3f633956729d460ef73', 'python/history_worker.py': 'c0f3f47f9613cd3bfde6e2b0a96e8f6a3c8699bfa9d162c98ad0f3166f9ddaba', 'python/history_timed_worker.py': '7eb2bd26b68f97ad3c6ea6180b55440fb9dcd4c12b2dace2502be439f0a1dd41'}
FINITE_STATISTICS_SHA256='c6db429dd77c88abe263c52dd0db4e5e76f321657dec53eb1ccec44280197371'

def validate_kernel_profile(profile,original,current):
    paths={'python/'+name for name in KERNELS}
    if profile not in ('original-v1','finite-bootstrap-v2'):
        raise ValueError('UNKNOWN_HISTORY_KERNEL_PROFILE')
    if type(original) is not dict or type(current) is not dict or set(original)!=paths or set(current)!=paths:
        raise ValueError('HISTORY_KERNEL_PROFILE_PATHS')
    hashes={};preserved={};changed=[]
    for path in sorted(paths):
        old,new=original[path],current[path]
        if type(old) is not bytes or type(new) is not bytes:
            raise ValueError('HISTORY_KERNEL_PROFILE_BYTES')
        old_sha=hashlib.sha256(old).hexdigest();new_sha=hashlib.sha256(new).hexdigest()
        if old_sha!=ORIGINAL_KERNEL_SHA256[path]:
            raise ValueError('HISTORY_REFERENCE_PIN_MISMATCH:'+path)
        permitted=profile=='finite-bootstrap-v2' and path=='python/history_statistics.py'
        if permitted:
            if new_sha!=FINITE_STATISTICS_SHA256:raise ValueError('FINITE_KERNEL_PROFILE_PIN_MISMATCH:'+path)
        elif old!=new:raise ValueError('HISTORICAL_KERNEL_SOURCE_MISMATCH:'+path)
        hashes[path]=new_sha
        if old==new:preserved[path]=new_sha
        else:changed.append(path)
    return {'kernel_profile':profile,'comparison_mode':'ORIGINAL_RAW_BYTE_PARITY' if profile=='original-v1' else 'PINNED_FINITE_PROFILE_NOT_ORIGINAL_BYTE_PARITY',
            'current_kernel_sha256':hashes,'preserved_original_kernel_sha256':preserved,'changed_kernel_paths':changed,
            'semantic_equivalence':'NOT_CLAIMED_BY_SOURCE_PROFILE','numerical_qualification':'SEPARATE_REQUIRED'}

def git(*args):
    return subprocess.check_output(['git', '--no-replace-objects', '-C', str(ROOT), *args], timeout=30)


def scientific(root):
    script = """import {pathToFileURL} from 'node:url';import {readFileSync} from 'node:fs';
const root=process.argv[1];const {executeScientificGraph}=await import(pathToFileURL(root+'/src/scientific-engine.mjs'));
process.stdout.write(JSON.stringify(executeScientificGraph(JSON.parse(readFileSync(root+'/examples/scientific-composition.v21.json')))));"""
    return subprocess.check_output([shutil.which('node'), '--input-type=module', '-e', script, str(root)], timeout=15)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--kernel-profile',choices=('original-v1','finite-bootstrap-v2'),default='original-v1')
    args=parser.parse_args()
    original={};current={}
    for name in KERNELS:
        path='python/'+name
        original[path]=git('show',HISTORY+':'+path)
        current[path]=git('show','HEAD:'+path)
    profile=validate_kernel_profile(args.kernel_profile,original,current)
    kernels=profile['preserved_original_kernel_sha256']
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
    if args.kernel_profile!='original-v1':
        receipt.update(schema='math.history.scientific.profile-parity.v2',**profile)
    (out / 'parity.json').write_text(json.dumps(receipt, indent=2, sort_keys=True), encoding='utf8')
    print(json.dumps(receipt, sort_keys=True))


if __name__ == '__main__': main()
