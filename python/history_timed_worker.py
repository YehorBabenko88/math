"""Opt-in isolated v1.1 worker; no database, broker or training capability."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import json
from history_contract import evaluate_timed_request, MAX_INPUT_BYTES
from history_worker import canonical

def main():
    raw=sys.stdin.buffer.read(MAX_INPUT_BYTES+1)
    if len(raw)>MAX_INPUT_BYTES:raise ValueError('INPUT_LIMIT')
    sys.stdout.buffer.write(canonical(evaluate_timed_request(json.loads(raw))))

if __name__=='__main__':main()
