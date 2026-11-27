"""Bounded synthetic geometry research slice; not a market-data or authority adapter.

No synthetic values are claimed to represent market history or training data.
Numerics belong to the reviewed C/E kernels, not this dispatcher.
"""

from __future__ import annotations

import math

from history_spherical import SphericalError, spherical_apply

_MAX_TIMESTAMP = (1 << 53) - 1
_MAX_STATES = 256
_SUPPORTED_AMBIENT = (4, 32)


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


def run_synthetic_geometry_v1(rows, event_ms, *, radius, cadence_ms):
    """Apply existing E/C numerics to a bounded synthetic 4D or 32D series.

    No fitting, qualification, market-source provenance, predictions, method
    ranking, storage, concurrency, file/network I/O or caller callbacks.
    A missing direction returns a typed refusal, never invented motion.
    """
    ambient, intrinsic = _validate_inputs(rows, event_ms, radius, cadence_ms)
    states = tuple(
        (row, spherical_apply('normalize', {'x': row}, intrinsic, radius))
        for row in rows
    )
    common = {
        'schema': 'math.universe.synthetic.geometry.v1',
        'status': 'UNQUALIFIED',
        'authority': 'NONE',
        'mode': 'SYNTHETIC_GEOMETRY_NO_FIT',
        'qualified': False,
        'fit': None,
        'ambient_dimension': ambient,
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
        intrinsic, radius,
    )
    return {**common,
            'trajectory': {'angles': tuple(result['angles']),
                           'distances': tuple(result['distances']),
                           'speeds': tuple(result['speeds'])},
            'reason': 'NO_QUALIFIED_SOURCE_OR_FIT'}
