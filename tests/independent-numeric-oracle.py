"""Independent P1 oracle. No candidate imports; binary64 values are exact rationals."""
import json
import math
import re
import struct
import sys
from fractions import Fraction

MAX = Fraction.from_float(sys.float_info.max)

def decode(bits):
    if not isinstance(bits, str) or not re.fullmatch(r"[0-9a-f]{16}", bits):
        raise ValueError("invalid bits")
    return struct.unpack(">d", bytes.fromhex(bits))[0]

def assess(row):
    if set(row) != {"id", "expected", "actual", "tolerance"}:
        raise ValueError("invalid fields")
    e, a, t = (decode(row[k]) for k in ("expected", "actual", "tolerance"))
    if not all(map(math.isfinite, (e, a, t))) or t < 0:
        return {"id": row["id"], "outcome": "REJECT_INPUT"}
    e, a, t = map(Fraction.from_float, (e, a, t))
    d = abs(a - e)
    b = t * max(Fraction(1), abs(e))
    if d > MAX or b > MAX:
        return {"id": row["id"], "outcome": "REJECT_RANGE"}
    return {"id": row["id"], "outcome": "PASS" if d <= b else "FAIL",
            "diagnostic": struct.pack(">d", float(d)).hex()}

def main():
    raw = sys.stdin.buffer.read(65537)
    if len(raw) > 65536:
        raise ValueError("input too large")
    rows = json.loads(raw)
    if not isinstance(rows, list) or not 1 <= len(rows) <= 256:
        raise ValueError("invalid batch")
    ids = [r["id"] for r in rows]
    if any(not isinstance(i, str) or not 1 <= len(i) <= 64 for i in ids) or len(set(ids)) != len(ids):
        raise ValueError("invalid ids")
    print(json.dumps([assess(r) for r in rows], allow_nan=False))

if __name__ == "__main__":
    main()
