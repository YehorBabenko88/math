"""Source-only causal diagnostics; no source authentication or execution authority."""
from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class Row:
    series: str
    epoch: str
    end_ms: int
    available_ms: int
    revision: int
    value: float


def _clock(x):
    return type(x) is int and 0 <= x <= 2**53 - 1


def _id(x):
    return type(x) is str and 0 < len(x) <= 128 and x.isascii()


def align(rows, *, roster, start_ms, end_ms, step_ms, as_of_ms):
    if not all(map(_clock, (start_ms, end_ms, step_ms, as_of_ms))):
        raise ValueError('CLOCK')
    if not step_ms or start_ms >= end_ms or (end_ms-start_ms) % step_ms:
        raise ValueError('CLOCK')
    if type(roster) is not tuple or not 1 <= len(roster) <= 12 or not all(map(_id, roster)) or len(set(roster)) != len(roster):
        raise ValueError('DIMENSION')
    if type(rows) is not tuple:
        raise ValueError('INVALID_SCHEMA')
    if (end_ms-start_ms)//step_ms > 20000 or len(rows) > 20000:
        raise ValueError('DIMENSION')
    selected, epochs, ledger = {}, {}, {}
    for r in rows:
        if type(r) is not Row or not _id(r.series) or r.series not in roster or not _id(r.epoch):
            raise ValueError('INVALID_SCHEMA')
        if not all(map(_clock, (r.end_ms, r.available_ms, r.revision))) or r.available_ms < r.end_ms:
            raise ValueError('CLOCK')
        if not start_ms < r.end_ms <= end_ms or r.available_ms >= as_of_ms:
            continue
        if (r.end_ms-start_ms) % step_ms:
            raise ValueError('CLOCK')
        if type(r.value) is not float or not isfinite(r.value):
            raise ValueError('INVALID_SCHEMA')
        if r.series in epochs and epochs[r.series] != r.epoch:
            raise ValueError('EPOCH_CONFLICT')
        epochs[r.series] = r.epoch
        key = (r.series, r.end_ms)
        identity = (*key, r.revision)
        if identity in ledger and (ledger[identity] != r or ledger[identity].value.hex() != r.value.hex()):
            raise ValueError('REVISION_CONFLICT')
        ledger[identity] = r
        if key not in selected or selected[key].revision < r.revision:
            selected[key] = r
    support, gaps, segments, current, missing = [], [], [], [], []
    for t in range(start_ms+step_ms, end_ms+1, step_ms):
        absent = tuple(s for s in roster if (s,t) not in selected)
        if absent:
            gaps.append(t)
            missing.append((t, absent))
            if current:
                segments.append(tuple(current))
                current = []
        else:
            point = (t, tuple(selected[s,t].value for s in roster))
            support.append(point)
            current.append(point)
    if current:
        segments.append(tuple(current))
    return {'roster':roster, 'step_ms':step_ms, 'support':tuple(support), 'gaps':tuple(gaps), 'missing':tuple(missing), 'segments':tuple(segments), 'selected':tuple(selected[k] for k in sorted(selected)), 'ledger':tuple(ledger[k] for k in sorted(ledger)), 'qualified':False, 'execution_authority':False, 'trading_authorized':False}


def spectral_eligibility(batch, *, min_samples):
    """Structural screen only; no stationarity or spectral inference."""
    if type(min_samples) is not int or min_samples < 3:
        raise ValueError('DIMENSION')
    reasons = []
    support = batch['support']
    if batch['gaps'] or any(b[0]-a[0] != batch['step_ms'] for a,b in zip(support,support[1:])):
        reasons.append('GAPS')
    if len(support) < min_samples:
        reasons.append('INSUFFICIENT_SAMPLES')
    if support and any(len({p[1][i] for p in support}) == 1 for i in range(len(batch['roster']))):
        reasons.append('CONSTANT_SERIES')
    return {'structurally_eligible':not reasons, 'qualified':False, 'reasons':tuple(reasons)+('SOURCE_UNATTESTED',)}
