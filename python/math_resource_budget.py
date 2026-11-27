"""DEV_CANDIDATE logical budget; not a native resource or authority grant."""
from dataclasses import dataclass, fields

MAX = (1 << 53) - 1
MAX_KINDS = 256
KINDS = frozenset(('coordinate', 'enumeration', 'pair_lookup', 'comparison', 'face', 'pivot', 'dsu_read', 'dsu_write', 'xor_word', 'serialization', 'sample', 'other'))

class BudgetExceeded(ValueError):
    pass

def _uint(value):
    if type(value) is not int or not 0 <= value <= MAX:
        raise ValueError('expected bounded unsigned integer')
    return value

@dataclass(frozen=True, slots=True)
class BudgetLimits:
    max_ops: int
    max_read_bytes: int
    max_write_bytes: int
    max_live_bytes: int
    max_output_bytes: int
    def __post_init__(self):
        for f in fields(self):
            _uint(getattr(self, f.name))

class BudgetCounter:
    """Single-thread-owned counter; share across nested kernels, not threads."""
    __slots__ = ('_limits', '_ops', '_read', '_write', '_live', '_peak', '_output', '_failed', '_kinds')
    def __init__(self, limits):
        if type(limits) is not BudgetLimits:
            raise TypeError('BudgetLimits required')
        self._limits = limits
        self._ops = self._read = self._write = self._live = self._peak = self._output = 0
        self._failed = False
        self._kinds = dict.fromkeys(sorted(KINDS), 0)
    def _check(self, checks):
        if self._failed:
            raise BudgetExceeded('BUDGET_EXCEEDED')
        if any(cost > limit - used for cost, limit, used in checks):
            self._failed = True
            raise BudgetExceeded('BUDGET_EXCEEDED')
    def preflight(self, *, ops=0, read_bytes=0, write_bytes=0, live_bytes=0, output_bytes=0):
        costs = tuple(map(_uint, (ops, read_bytes, write_bytes, live_bytes, output_bytes)))
        l = self._limits
        self._check(zip(costs, (l.max_ops,l.max_read_bytes,l.max_write_bytes,l.max_live_bytes,l.max_output_bytes), (self._ops,self._read,self._write,self._live,self._output)))
    def charge(self, kind, *, ops=0, read_bytes=0, write_bytes=0):
        if type(kind) is not str or not kind or len(kind)>64 or not kind.isascii() or not all(ch.isalnum() or ch in "_.-" for ch in kind):
            raise ValueError('unknown operation kind')
        self.preflight(ops=ops, read_bytes=read_bytes, write_bytes=write_bytes)
        if kind not in self._kinds and len(self._kinds) >= MAX_KINDS:
            self._failed = True
            raise BudgetExceeded("BUDGET_EXCEEDED")
        self._ops += ops
        self._read += read_bytes
        self._write += write_bytes
        self._kinds[kind] = self._kinds.get(kind, 0) + ops
    def reserve_memory(self, size):
        self.preflight(live_bytes=size)
        self._live += size
        self._peak = max(self._peak, self._live)
    def release_memory(self, size):
        _uint(size)
        if size > self._live:
            self._failed = True
            raise ValueError('memory release underflow')
        self._live -= size
    def charge_output(self, size):
        self.preflight(output_bytes=size)
        self._output += size
    def snapshot(self):
        return {'ops':self._ops,'read_bytes':self._read,'write_bytes':self._write,'live_bytes':self._live,'peak_bytes':self._peak,'output_bytes':self._output,'failed':self._failed,'by_kind':dict(self._kinds)}
