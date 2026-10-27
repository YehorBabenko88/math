"""Deterministic structural validator; does not certify mathematical claims."""
import argparse
import hashlib
import json
from pathlib import Path

MAX_TEXT = 100_000
KEYS = {"schema", "problem", "context", "digest", "status"}

def validate(document):
    if not isinstance(document, dict) or set(document) != KEYS:
        raise ValueError("unexpected request fields")
    if document["schema"] != "math.aim.research.v1" or document["status"] != "UNVERIFIED":
        raise ValueError("unsupported schema or status")
    problem, context = document["problem"], document["context"]
    if not isinstance(problem, str) or not problem.strip() or len(problem) > MAX_TEXT:
        raise ValueError("invalid problem")
    if not isinstance(context, str) or len(context) > MAX_TEXT:
        raise ValueError("invalid context")
    digest = hashlib.sha256((problem + "\0" + context).encode("utf-8")).hexdigest()
    if document["digest"] != digest:
        raise ValueError("digest mismatch")
    return {"schema": document["schema"], "digest": digest, "integrity": "PASS",
            "proof_status": "UNVERIFIED"}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("request")
    args = parser.parse_args()
    path = Path(args.request)
    if path.stat().st_size > 500_000:
        raise ValueError("request file too large")
    print(json.dumps(validate(json.loads(path.read_text(encoding="utf-8")))))

if __name__ == "__main__":
    main()
