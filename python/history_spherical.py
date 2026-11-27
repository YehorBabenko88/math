"""Pure, bounded, source-only hyperspherical research kernel.

Inputs must already be qualified by the trusted Math Space adapter. The kernel
validates them independently and never reads market or external state.
"""

from __future__ import annotations

import math
# The sole generic checked arithmetic implementation is owned by Agent C.
# Keep this source-only development candidate inert until the C module is present.
try:
    import history_metric_core as _metric_core
except ModuleNotFoundError as exc:
    if exc.name != 'history_metric_core':
        raise
    _metric_core = None

MIN_RADIUS = 2.0 ** -500
MAX_RADIUS = 2.0 ** 500
MAX_DIMENSION = 255
MAX_VECTOR_COMPONENTS = 256
UNIT_ULPS_PER_COORDINATE = 8.0
ANTIPODE_GUARD = 1e-8


class SphericalError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _number(value: object) -> float:
    # A-v1/C ABI admits literal binary64 floats only; never coerce integers,
    # booleans, subclasses, Decimal, or attacker-controlled __float__ methods.
    if type(value) is not float or not math.isfinite(value):
        raise SphericalError('INVALID_NUMBER')
    return value


def _dimension(dimension: object) -> int:
    if type(dimension) is not int or not 1 <= dimension <= MAX_DIMENSION:
        raise SphericalError('DIMENSION')
    return dimension


def _radius(radius: object) -> float:
    radius = _number(radius)
    if radius <= 0.0:
        raise SphericalError('INVALID_NUMBER')
    return radius


def _vector(values: object, n: int) -> tuple[float, ...]:
    if type(values) not in (list, tuple) or len(values) != n:
        raise SphericalError('DIMENSION')
    return tuple(_number(value) for value in values)


def _metric():
    if _metric_core is None:
        raise SphericalError('DEPENDENCY_UNAVAILABLE')
    return _metric_core


def _checked(value: float, *, nonzero: bool = False) -> float:
    # Geometry-specific output of transcendental functions, never a substitute
    # for C's checked arithmetic or exact represented-input range guards.
    if not math.isfinite(value):
        raise SphericalError('NUMERIC_OVERFLOW')
    if nonzero and value == 0.0:
        raise SphericalError('NUMERIC_UNDERFLOW')
    return 0.0 if value == 0.0 else value


def _c(operation: str, *args: object) -> float:
    core = _metric()
    try:
        return getattr(core, operation)(*args)
    except ValueError as exc:
        code = str(exc)
        if code in {'INVALID_NUMBER', 'DIMENSION', 'NUMERIC_OVERFLOW',
                    'NUMERIC_UNDERFLOW', 'ZERO_DIVISOR', 'BUDGET_EXCEEDED'}:
            raise SphericalError(code) from None
        raise


def _norm(values: tuple[float, ...]) -> float:
    return _c('checked_norm', values)


def _unit(values: object, n: int) -> tuple[float, ...]:
    values = _vector(values, n)
    magnitude = _norm(values)
    if magnitude == 0.0:
        raise SphericalError('ZERO_DIRECTION')
    if abs(magnitude - 1.0) > UNIT_ULPS_PER_COORDINATE * n * 2 ** -52:
        raise SphericalError('NOT_UNIT')
    # A-v1 validation is NOT permission to repair an admitted near-unit input.
    # Preserve its exact represented components and associated provenance.
    return values


def _sum_products(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    return _c('checked_dot', a, b)


def _encode(x: tuple[float, ...]) -> dict:
    m = max(map(abs, x), default=0.0)
    # C owns exact squared-norm range and numeric underflow precedence.
    rho = _norm(x)
    if m == 0.0:
        return {'rho': 0.0, 'u': None}
    normalized = tuple(_c('checked_div', v, m) for v in x)
    h = _norm(normalized)
    u = tuple(_c('checked_div', v, h) for v in normalized)
    return {'rho': rho, 'u': u}


def _decode(rho: object, u: object, n: int) -> tuple[float, ...]:
    rho = _number(rho)
    if rho < 0.0:
        raise SphericalError('INVALID_OPERATION')
    if rho == 0.0:
        if u is not None:
            raise SphericalError('INVALID_OPERATION')
        return (0.0,) * n
    if u is None:
        raise SphericalError('ZERO_DIRECTION')
    direction = _unit(u, n)
    result = tuple(_c('checked_mul', rho, v) for v in direction)
    return result


def _angle(u: tuple[float, ...], w: tuple[float, ...]) -> tuple[float, float]:
    if u == w:
        return 0.0, 2.0
    # Norm-weighted chord lengths depend on direction, not admissible
    # near-unit magnitudes. Keep the original stored vectors unchanged.
    nu, nw = _norm(u), _norm(w)
    left = tuple(_c('checked_mul', nw, x) for x in u)
    right = tuple(_c('checked_mul', nu, x) for x in w)
    a = _c('checked_distance', left, right)
    b = _norm(tuple(_c('checked_dot', (x, y), (1.0, 1.0))
                    for x, y in zip(left, right)))
    # Distinct binary64 tuples can lie on exactly the same ray; their
    # geodesic distance is zero, not an underflow or a cut-locus failure.
    if a == 0.0:
        return 0.0, b
    # For a=minsubnormal and b>=2, atan(a/b) underflows; refuse
    # before relying on platform-specific libm behavior.
    if a == math.ulp(0.0) and b >= 2.0:
        raise SphericalError('NUMERIC_UNDERFLOW')
    angle = _checked(2.0 * math.atan2(a, b), nonzero=True)
    return angle, b


def _tangent(u: tuple[float, ...], v: tuple[float, ...]) -> tuple[float, ...]:
    m = max(map(abs, v), default=0.0)
    if m == 0.0:
        return (0.0,) * len(v)
    # Check exact-axis projections BEFORE any magnitude scaling. Scaling a
    # minsubnormal transverse coordinate by MAX would underflow needlessly,
    # even though the true orthogonal projection is exactly representable.
    # An exactly axis-aligned direction has a canonical tangent plane:
    # set its radial coordinate to exact zero and preserve all admitted
    # transverse components. No rounded ratio may create fake radial motion.
    nonzero_axis = [i for i, x in enumerate(u) if x != 0.0]
    if len(nonzero_axis) == 1:
        radial_index = nonzero_axis[0]
        return tuple(0.0 if i == radial_index else value
                     for i, value in enumerate(v))
    # Non-axis projections still use C-checked arithmetic and refuse
    # precision loss instead of silently dropping transverse components.
    s = tuple(_c('checked_div', x, m) for x in v)
    # For an admitted near-unit u, projection coefficient is <u,s>/<u,u>,
    # NOT <u,s>; otherwise radial leakage corrupts trajectory tangents.
    radial = _sum_products(u, s)
    squared_u = _sum_products(u, u)
    coefficient = _c('checked_div', radial, squared_u)
    projected = tuple(
        _c('checked_mul',
           _c('checked_dot', (x, -coefficient), (1.0, y)), m)
        for x, y in zip(s, u)
    )
    return projected


def _exp(u: tuple[float, ...], v: tuple[float, ...], r: float) -> tuple[float, ...]:
    if not any(v):
        return u
    vnorm = _norm(v)
    unit_tangent = tuple(_c('checked_div', x, vnorm) for x in v)
    # Relative orthogonality compares |<u,t>| to ||u|| * ||t||.
    if (abs(_sum_products(u, unit_tangent)) >
            UNIT_ULPS_PER_COORDINATE * len(u) * 2 ** -52 * _norm(u)):
        raise SphericalError('NOT_TANGENT')
    v = _tangent(u, v)
    vnorm = _norm(v)
    cap = math.pi * r
    if vnorm > cap:
        raise SphericalError('CUT_LOCUS')
    if vnorm == cap:
        return tuple(-x for x in u)
    alpha = _c('checked_div', vnorm, r)
    t = tuple(_c('checked_div', x, vnorm) for x in v)
    result = tuple(_checked(math.cos(alpha) * x + math.sin(alpha) * y)
                   for x, y in zip(u, t))
    return _unit(result, len(u))


def _log(u: tuple[float, ...], w: tuple[float, ...], r: float) -> tuple[float, ...]:
    if u == w:
        return (0.0,) * len(u)
    angle, b = _angle(u, w)
    if b == 0.0 or all(x == -y for x, y in zip(u, w)):
        raise SphericalError('ANTIPODAL_AMBIGUITY')
    if b <= ANTIPODE_GUARD:
        raise SphericalError('CUT_LOCUS')
    if angle == 0.0:
        return (0.0,) * len(u)
    v = _tangent(u, tuple(x - y for x, y in zip(w, u)))
    magnitude = _norm(v)
    if magnitude == 0.0:
        raise SphericalError('CUT_LOCUS')
    length = _c('checked_mul', r, angle)
    return tuple(_c('checked_mul', _c('checked_div', x, magnitude), length) for x in v)


def _trajectory(rows: object, cadence_ms: object, r: float, n: int) -> dict:
    if type(cadence_ms) is not int or not 1 <= cadence_ms <= 2 ** 53 - 1:
        raise SphericalError('CADENCE')
    if type(rows) not in (tuple, list) or not 2 <= len(rows) <= 256:
        raise SphericalError('CADENCE')
    times: list[int] = []
    directions: list[tuple[float, ...]] = []
    for row in rows:
        if type(row) is not dict or set(row) != {'event_end_ms', 'u'}:
            raise SphericalError('CADENCE')
        timestamp = row['event_end_ms']
        if type(timestamp) is not int or not 0 <= timestamp <= 2 ** 53 - 1:
            raise SphericalError('CADENCE')
        if times and timestamp - times[-1] != cadence_ms:
            raise SphericalError('CADENCE')
        times.append(timestamp)
        directions.append(_unit(row['u'], n))
    segments = []
    for i in range(1, len(times)):
        angle, _ = _angle(directions[i - 1], directions[i])
        arc = _c('checked_mul', r, angle)
        dt = (times[i] - times[i - 1]) / 1000.0
        speed = _c('checked_div', arc, dt)
        segments.append({'from_ms': times[i - 1], 'to_ms': times[i],
                         'angle_rad': angle, 'arc_length': arc,
                         'angular_speed_rad_s': _c('checked_div', angle, dt),
                         'speed_per_s': speed})
    return {'segments': segments, 'is_market_qualified': False}


def spherical_apply(op: object, args: object, dimension: object, radius: object,
                    *, budget: object = None) -> dict:
    """A v1 internal sphere ABI: angular tangent; no owner/fit/receipt authority.

    Without a shared V budget, only bounded pure development calls admit budget=None.
    A non-None budget is refused until the trusted shared budget contract is present.
    """
    if budget is not None:
        raise SphericalError('BUDGET_EXCEEDED')
    n = _dimension(dimension) + 1
    r = _radius(radius)
    _metric()  # Reject every geometry operation until C is available.
    if type(op) is not str or type(args) is not dict:
        raise SphericalError('INVALID_OPERATION')
    keys = {
        'normalize': {'x'},
        'geodesic': {'u', 'v'},
        'tangent': {'u', 'v'},
        'exp': {'u', 'tangent'},
        'log': {'u', 'v'},
        'trajectory': {'directions', 'event_ms', 'cadence_ms'},
    }
    if op not in keys or set(args) != keys[op]:
        raise SphericalError('INVALID_OPERATION')
    if op == 'normalize':
        return _encode(_vector(args['x'], n))
    if op == 'trajectory':
        directions = args['directions']
        times = args['event_ms']
        if (type(directions) not in (list, tuple) or
            type(times) not in (list, tuple) or
            len(directions) != len(times) or
            not 2 <= len(directions) <= 256):
            raise SphericalError('CADENCE')
        # The resource/cadence preflight must precede any temporary row list.
        cadence_ms = args['cadence_ms']
        if (type(cadence_ms) is not int or
            not 1 <= cadence_ms <= 2 ** 53 - 1):
            raise SphericalError('CADENCE')
        rows = [{'event_end_ms': t, 'u': d} for t, d in zip(times, directions)]
        try:
            result = _trajectory(rows, args['cadence_ms'], r, n)
        except SphericalError as exc:
            if exc.code == 'INVALID_NUMBER':
                raise SphericalError('CADENCE') from None
            raise
        return {'angles': [s['angle_rad'] for s in result['segments']],
                'distances': [s['arc_length'] for s in result['segments']],
                'speeds': [s['speed_per_s'] for s in result['segments']]}
    u = _unit(args['u'], n)
    if op in ('geodesic', 'log'):
        v = _unit(args['v'], n)
        if op == 'geodesic':
            angle, _ = _angle(u, v)
            return {'angle': angle,
                    'distance': _c('checked_mul', r, angle)}
        return {'tangent': _log(u, v, 1.0)}
    if op == 'exp':
        tangent = _vector(args['tangent'], n)
        if _norm(tangent) >= math.pi:
            raise SphericalError('CUT_LOCUS')
        return {'u': _exp(u, tangent, 1.0)}
    tangent = _tangent(u, _vector(args['v'], n))
    return {'tangent': tangent}
