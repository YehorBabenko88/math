"""Bounded synthetic geometry research slice; not a market-data or authority adapter.

No synthetic values are claimed to represent market history or training data.
Numerics belong to the reviewed C/E kernels, not this dispatcher.
"""

from __future__ import annotations

import math

from history_spherical import SphericalError, spherical_apply, _runner_budget_scope

_MAX_TIMESTAMP = (1 << 53) - 1
_MAX_STATES = 256
_SUPPORTED_AMBIENT = (4, 32)


def _budget_quote(n: int, k: int) -> dict:
    """Conservative V-reviewed E_LOGICAL_V1 narrow-runner envelope.

    C is charged by C only. Outer C quote is preflight, never a debit.
    These are abstract logical costs, not physical RAM/CPU measurements.
    """
    if type(n) is not int or n not in _SUPPORTED_AMBIENT or type(k) is not int or not 2 <= k <= 256:
        raise SphericalError('DIMENSION')
    a, d, p = 6*k-3, k-1, n*(k-1)
    scalars = 2*n*k+(2*n+3)*(k-1)
    c_ops = a*(3*n*8192+64*16384)+d*(4*n*8192+64*16384)+p*65536+scalars*32768
    c_read = 8*n*a+16*n*d+32*p+16*scalars
    c_write = 16*n*(a+d)+32*p+16*scalars
    c_output = 8*(a+d+p+scalars)
    c_peak = 4096*(4*n+16)
    core_ops = 4096*(n+1)*(3*k+1)
    core_b = 256*(n+1)*(3*k+1)
    core_peak = 4096+256*(n+1)*(k+1)
    intermediate = k*(256+64*n)+256+128*(k-1)
    wrapper_ops = 64*k*(n+1)
    wrapper_read = 8*k*(n+1)
    wrapper_write = wrapper_read+24*(k-1)
    wrapper_scratch = 4096+k*(64+16*n)+64*(k-1)
    retained = 512+k*(16*n+144)+56*(k-1)
    return {
        'ops': c_ops+core_ops+wrapper_ops,
        'read_bytes': c_read+core_b+wrapper_read,
        'write_bytes': c_write+core_b+wrapper_write,
        'live_bytes': c_peak+core_peak+wrapper_scratch+intermediate+retained,
        'output_bytes': c_output+intermediate+retained,
        'core_ops': core_ops,
        'wrapper_ops': wrapper_ops,
        'wrapper_read': wrapper_read,
        'wrapper_write': wrapper_write,
        'wrapper_scratch': wrapper_scratch,
        'intermediate': intermediate,
        'retained': retained,
    }


class GeometryResultLease:
    """Trust-bound, single-release logical V reservation for the returned DTO.

    The caller must release on detach / completed persistence. It is not a
    physical memory guard or execution-authority token. The budget is the same
    single-thread-owned counter used by C and E during the computation.
    """
    __slots__ = ('result', '_budget', '_retained')

    # A lease is the *sole* release authority for one logical V reservation.
    # The default Python slot copy/pickle machinery duplicates that authority
    # without reserving any additional memory, so a copied lease can release
    # another live result's capacity. Copies of the detached plain result DTO
    # remain the trusted host's separately accounted responsibility.
    def __copy__(self):
        raise TypeError('GeometryResultLease cannot be copied')

    def __deepcopy__(self, memo):
        raise TypeError('GeometryResultLease cannot be deep-copied')

    def __reduce_ex__(self, protocol):
        raise TypeError('GeometryResultLease cannot be serialized')

    def __reduce__(self):
        raise TypeError('GeometryResultLease cannot be serialized')

    def __init__(self, result: dict, budget: object, retained: int):
        self.result = result
        self._budget = budget
        self._retained = retained

    def release(self) -> None:
        if self._retained == 0:
            raise SphericalError('BUDGET_EXCEEDED')
        size = self._retained
        self._budget.release_memory(size)
        self._retained = 0
        self.result = None

    def __enter__(self):
        if self._retained == 0:
            raise SphericalError('BUDGET_EXCEEDED')
        return self

    def __exit__(self, exc_type, exc, tb):
        self.release()
        return False


def _validate_inputs(rows: object, event_ms: object, radius: object,
                     cadence_ms: object) -> tuple[int, int]:
    """Admit only immutable, literal, bounded DTO values before processing rows."""
    if type(rows) is not tuple or not 2 <= len(rows) <= _MAX_STATES:
        raise SphericalError('DIMENSION')
    ambient = len(rows[0]) if type(rows[0]) is tuple else 0
    if ambient not in _SUPPORTED_AMBIENT:
        raise SphericalError('DIMENSION')
    if type(event_ms) is not tuple or len(event_ms) != len(rows):
        raise SphericalError('CADENCE')
    if type(cadence_ms) is not int or not 1 <= cadence_ms <= _MAX_TIMESTAMP:
        raise SphericalError('CADENCE')
    if type(radius) is not float or not math.isfinite(radius) or radius <= 0.0:
        raise SphericalError('INVALID_NUMBER')
    for index, stamp in enumerate(event_ms):
        if type(stamp) is not int or not 0 <= stamp <= _MAX_TIMESTAMP:
            raise SphericalError('CADENCE')
        if index and stamp - event_ms[index - 1] != cadence_ms:
            raise SphericalError('CADENCE')
    for row in rows:
        if type(row) is not tuple or len(row) != ambient:
            raise SphericalError('DIMENSION')
        for value in row:
            if type(value) is not float or not math.isfinite(value):
                raise SphericalError('INVALID_NUMBER')
    return ambient, ambient - 1


def run_synthetic_geometry_v1(rows, event_ms, *, radius, cadence_ms, budget=None):
    """Existing unmetered behavior or bounded DEV E_LOGICAL_V1 with V.

    budget=None retains the original pure dict API. A non-None *exact* V
    BudgetCounter returns a GeometryResultLease; a trusted host owns its
    release. This synthetic method never confers source/fit/trading authority.
    """
    ambient, intrinsic = _validate_inputs(rows, event_ms, radius, cadence_ms)
    if budget is None:
        return _run_geometry(rows, event_ms, radius, cadence_ms, intrinsic)
    try:
        from math_resource_budget import BudgetCounter
    except ImportError:
        raise SphericalError('BUDGET_EXCEEDED') from None
    if type(budget) is not BudgetCounter:
        raise SphericalError('BUDGET_EXCEEDED')
    q = _budget_quote(ambient, len(rows))
    # Quote includes *all* nested C preflights, all E scratch, staging and
    # final custody. One atomic V preflight before allocation or C computation.
    try:
        budget.preflight(ops=q['ops'], read_bytes=q['read_bytes'],
                         write_bytes=q['write_bytes'], live_bytes=q['live_bytes'],
                         output_bytes=q['output_bytes'])
    except ValueError as exc:
        if str(exc) == 'BUDGET_EXCEEDED':
            raise SphericalError('BUDGET_EXCEEDED') from None
        raise
    # Reserve only real wrapper-owned scratch/staging and host custody;
    # metered E and C individually reserve their own *temporary* scratch.
    reserved = 0
    committed = False
    try:
        for size in (q['wrapper_scratch'], q['intermediate'], q['retained']):
            budget.reserve_memory(size)
            reserved += size
        budget.charge('sample', ops=q['wrapper_ops'], read_bytes=q['wrapper_read'])
        budget.charge('serialization', write_bytes=q['wrapper_write'])
        with _runner_budget_scope(budget):
            result = _run_geometry(rows, event_ms, radius, cadence_ms, intrinsic, budget=budget)
        budget.charge_output(q['retained'])
        # Only the final result reserve survives the call; the caller must
        # release this lease. No opaque dict is returned without its custody.
        budget.release_memory(q['intermediate'])
        budget.release_memory(q['wrapper_scratch'])
        committed = True
        return GeometryResultLease(result, budget, q['retained'])
    except ValueError as exc:
        if str(exc) == 'BUDGET_EXCEEDED':
            raise SphericalError('BUDGET_EXCEEDED') from None
        raise
    finally:
        if not committed and reserved:
            budget.release_memory(reserved)


def _run_geometry(rows, event_ms, radius, cadence_ms, intrinsic, budget=None):
    """One geometry algorithm path for both original pure and metered modes."""
    states = tuple(
        (row, spherical_apply('normalize', {'x': row}, intrinsic, radius, budget=budget))
        for row in rows
    )
    common = {
        'schema': 'math.universe.synthetic.geometry.v1',
        'status': 'UNQUALIFIED',
        'authority': 'NONE',
        'mode': 'SYNTHETIC_GEOMETRY_NO_FIT',
        'qualified': False,
        'fit': None,
        'ambient_dimension': intrinsic + 1,
        'intrinsic_dimension': intrinsic,
        'radius': radius,
        'cadence_ms': cadence_ms,
        'event_ms': event_ms,
        'states': tuple({'raw': raw, 'rho': encoded['rho'], 'u': encoded['u']}
                        for raw, encoded in states),
    }
    if any(encoded['u'] is None for _, encoded in states):
        return {**common, 'trajectory': None, 'reason': 'ZERO_DIRECTION'}
    result = spherical_apply(
        'trajectory',
        {'directions': tuple(encoded['u'] for _, encoded in states),
         'event_ms': event_ms,
         'cadence_ms': cadence_ms},
        intrinsic, radius, budget=budget,
    )
    return {**common,
            'trajectory': {'angles': tuple(result['angles']),
                           'distances': tuple(result['distances']),
                           'speeds': tuple(result['speeds'])},
            'reason': 'NO_QUALIFIED_SOURCE_OR_FIT'}
