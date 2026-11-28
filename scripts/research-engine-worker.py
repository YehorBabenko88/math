"""Fixed reviewed subprocess entrypoint. Binary64 travels as canonical hex."""
import dataclasses
import json
from pathlib import Path
import struct
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'python'))
from history_causal import Row
from math_resource_budget import BudgetCounter, BudgetLimits, BudgetExceeded
from math_universe_research_engine import run_research_v1


def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('DUPLICATE_KEY')
        result[key] = value
    return result


def wire(value):
    if type(value) is float:
        # Kernels refuse NaN/Infinity; never hide nonfinite output.
        import math
        if not math.isfinite(value):
            raise ValueError('INVALID_NUMBER')
        return {'binary64': struct.pack('>d', 0.0 if value == 0 else value).hex()}
    if dataclasses.is_dataclass(value):
        return wire(dataclasses.asdict(value))
    if type(value) is dict:
        return {key: wire(item) for key, item in value.items()}
    if type(value) in (tuple, list):
        return [wire(item) for item in value]
    return value


def main():
    raw = sys.stdin.buffer.read(262145)
    if len(raw) > 262144:
        raise ValueError('INPUT_LIMIT')
    q = json.loads(raw, object_pairs_hook=reject_duplicates,
                   parse_constant=lambda _: (_ for _ in ()).throw(ValueError('INVALID_NUMBER')))
    rows = tuple(Row(r['series'], r['epoch'], r['end_ms'], r['available_ms'],
                     r['revision'], struct.unpack('>d', bytes.fromhex(r['value_bits']))[0]) for r in q['rows'])
    budget = BudgetCounter(BudgetLimits(**q['budget']))
    # Canonical V owns byte accounting at the host seam too. The fixed quote
    # covers the public JS envelope, M structural DTO and this counter snapshot.
    # It is conservative logical custody, not a claim about native RSS.
    host_quote = 20480
    budget.preflight(read_bytes=len(raw), write_bytes=host_quote,
                     live_bytes=len(raw)+host_quote, output_bytes=host_quote)
    budget.charge('serialization', read_bytes=len(raw), write_bytes=host_quote)
    budget.reserve_memory(len(raw)+host_quote)
    budget.charge_output(host_quote)
    host_live = budget.snapshot()['live_bytes']
    result = run_research_v1({**{k:q[k] for k in ('start_ms','end_ms','as_of_ms','cadence_ms')},
                              'roster':tuple(q['roster']), 'rows':rows}, budget=budget)
    # Engine transfers exact retained JSON custody. C/E temporary output credits
    # are cumulative work and cannot stand in for that retained representation.
    retained_size = budget.snapshot()['live_bytes'] - host_live
    wire_staging = min(262144, retained_size * 12 + 4096)
    budget.preflight(live_bytes=wire_staging, write_bytes=wire_staging)
    budget.reserve_memory(wire_staging)
    encoded_result = json.dumps(wire(result), separators=(',', ':'), allow_nan=False).encode()
    # Engine already retains its Python JSON result. Charge only expansion to
    # hexadecimal wire, plus the public envelope quote already reserved above.
    if len(encoded_result) > wire_staging:
        raise ValueError('OUTPUT_LIMIT')
    expansion = max(0, len(encoded_result) - retained_size)
    budget.preflight(output_bytes=expansion)
    budget.charge('serialization', write_bytes=len(encoded_result))
    budget.release_memory(wire_staging - len(encoded_result))
    budget.charge_output(expansion)
    budget.release_memory(len(raw))
    result['logical_budget'] = budget.snapshot()
    encoded = json.dumps(wire(result), separators=(',', ':'), allow_nan=False).encode()
    if len(encoded) > 262144:
        raise ValueError('OUTPUT_LIMIT')
    sys.stdout.buffer.write(encoded)


if __name__ == '__main__':
    try:
        main()
    except BudgetExceeded:
        sys.stdout.write('{"error":"BUDGET_EXCEEDED"}')
        sys.exit(2)
    except (ValueError, TypeError, KeyError, OverflowError):
        sys.stdout.write('{"error":"RESEARCH_REFUSED"}')
        sys.exit(2)
