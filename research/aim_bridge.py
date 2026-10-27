"""Offline-first AIM research bridge. Standard library only; no implicit execution."""
from __future__ import annotations
import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile\nfrom validate_request import validate

MAX_TEXT = 100_000

def prepare(problem: str, context: str = "") -> dict:
    if not isinstance(problem, str) or not problem.strip() or len(problem) > MAX_TEXT:
        raise ValueError("problem must contain 1..100000 characters")
    if not isinstance(context, str) or len(context) > MAX_TEXT:
        raise ValueError("context must contain at most 100000 characters")
    return {"schema": "math.aim.research.v1", "problem": problem, "context": context,
            "digest": hashlib.sha256((problem + "\0" + context).encode()).hexdigest(),
            "status": "UNVERIFIED"}

def run_local(request: dict, executable: str, timeout: int = 120) -> dict:
    """Explicit opt-in subprocess. Does not grant a proof-validity claim."""
    if not 1 <= timeout <= 3600:
        raise ValueError("timeout out of range")
    if request.get("schema") != "math.aim.research.v1":
        raise ValueError("unsupported request")
    if not pathlib.Path(executable).is_absolute():\n        raise ValueError("absolute executable path required")\n    binary = pathlib.Path(executable).resolve(strict=True)
    if not binary.is_file():
        raise ValueError("executable is not a file")
    with tempfile.TemporaryDirectory(prefix="math-aim-") as directory:
        root = pathlib.Path(directory)
        (root / "problem.md").write_text(request["problem"], encoding="utf-8")
        (root / "context.md").write_text(request["context"], encoding="utf-8")
        try:
            result = subprocess.run([str(binary), "-p", str(root)], cwd=root,
                                    capture_output=True, text=True, timeout=timeout,
                                    check=False)
            return {"schema": request["schema"], "digest": request["digest"],
                    "status": "UNVERIFIED" if result.returncode == 0 else "FAILED",
                    "exit_code": result.returncode,
                    "stdout_tail": result.stdout[-8000:],
                    "stderr_tail": result.stderr[-4000:]}
        except subprocess.TimeoutExpired:
            return {"schema": request["schema"], "digest": request["digest"],
                    "status": "TIMEOUT"}

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--problem-file", required=True)
    parser.add_argument("--context-file")
    parser.add_argument("--aim-binary", help="Explicitly execute trusted, pinned AIM binary")
    parser.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()
    problem = pathlib.Path(args.problem_file).read_text(encoding="utf-8")
    context = pathlib.Path(args.context_file).read_text(encoding="utf-8") if args.context_file else ""
    request = prepare(problem, context)
    print(json.dumps(run_local(request, args.aim_binary, args.timeout) if args.aim_binary else request))

if __name__ == "__main__":
    main()
