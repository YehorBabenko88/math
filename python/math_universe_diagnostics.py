"""Bounded descriptive composition of canonical C/H/G/F over I-aligned support.

Alignment, completeness, custody and causal/source qualification belong to I and
its caller. This module never reconstructs missing events or grants authority.
"""
from itertools import combinations
from hashlib import sha256
import json
import math
from history_metric_core import checked_distance
from history_pearson import pearson_aligned_v1
from history_graph_core import kruskal_forest_v1
from history_topology import rips_persistence_v1
from math_resource_budget import BudgetCounter, BudgetExceeded

# Versioned descriptive numeric policy: represented binary64, canonical H.
NUMERIC_POLICY_REF = sha256(b'math.universe.diagnostics.binary64.C_H_G_F.v1').hexdigest()


def analyze_aligned_support(support, *, budget):
    """Return JSON-compatible diagnostics and retain their byte custody in V.

    <=256 rows and <=32 features; full pairwise geometry only for 2..8 rows.
    Every child consumes the supplied exact V counter. Logical reservations
    bound staging before enumeration; they are not a native RSS guarantee.
    Caller must eventually release retained serialized-result bytes.
    """
    if type(budget) is not BudgetCounter:
        raise TypeError('BudgetCounter required')
    if type(support) is not tuple or len(support)>256:
        raise ValueError('DIAGNOSTICS_SUPPORT')
    n=len(support)
    # Constant-time shape probe; full validation and copying follow preflight.
    if n and (type(support[0]) is not tuple or len(support[0])!=2 or type(support[0][1]) is not tuple):
        raise ValueError('DIAGNOSTICS_SUPPORT')
    d=len(support[0][1]) if n else 0
    if n and not 1<=d<=32:
        raise ValueError('DIAGNOSTICS_DIMENSION')
    staging=65536+max(1,n)*max(1,d)*256
    before=budget.snapshot()['live_bytes']
    try:
        budget.preflight(ops=max(1,n)*max(1,d)*16,read_bytes=max(1,n)*(d*8+16),
                         write_bytes=staging,live_bytes=staging)
        budget.reserve_memory(staging)
        budget.charge('enumeration',ops=max(1,n)*max(1,d)*16,
                      read_bytes=max(1,n)*(d*8+16),write_bytes=staging)
        previous=None
        for row in support:
            if (type(row) is not tuple or len(row)!=2 or type(row[0]) is not int
                    or not 0<=row[0]<=2**53-1 or (previous is not None and row[0]<=previous)
                    or type(row[1]) is not tuple or len(row[1])!=d
                    or any(type(v) is not float or not math.isfinite(v) for v in row[1])):
                raise ValueError('DIAGNOSTICS_SUPPORT')
            previous=row[0]
        columns=tuple(tuple(row[1][i] for row in support) for i in range(d))
        def correlation(x,y):
            return pearson_aligned_v1(x,y,min_overlap=3,numeric_policy_ref=NUMERIC_POLICY_REF,budget=budget)._asdict()
        first=correlation(columns[0],columns[1]) if d>=2 else {'status':'NOT_RUN','reason_code':'NEEDS_TWO_FEATURES'}
        adjacent=tuple(correlation(column[:-1],column[1:]) for column in columns)
        geometry={'status':'NOT_RUN','reason':'INSUFFICIENT_SUPPORT' if n<2 else 'PAIRWISE_SUPPORT_LIMIT_8'}
        if 2<=n<=8:
            ids=tuple(('state%03d'%i).encode('ascii') for i in range(n))
            pairs=tuple(combinations(range(n),2))
            distances=tuple(checked_distance(support[i][1],support[j][1],budget=budget) for i,j in pairs)
            edges=tuple((ids[i],ids[j],distance) for (i,j),distance in zip(pairs,distances))
            forest=kruskal_forest_v1(ids,edges,budget)
            cutoff=max(distances)
            bars=rips_persistence_v1(ids,distances,cutoff,budget=budget)
            geometry={'status':'COMPUTED','metric':'EUCLIDEAN_REPRESENTED_BINARY64',
                      'state_event_end_ms':tuple(row[0] for row in support),
                      'pair_order':pairs,'pairwise_distances':distances,
                      'forest':{'edges':tuple((a.decode('ascii'),b.decode('ascii'),w) for a,b,w in forest.accepted_edges),
                                'components':tuple(tuple(v.decode('ascii') for v in group) for group in forest.components)},
                      'cutoff':cutoff,'bars':bars}
        result={'schema':'math.universe.descriptive-diagnostics.v1','status':'DESCRIPTIVE_ONLY',
                'execution_authority':False,'trading_authorized':False,
                'support_size':n,'feature_count':d,
                'statistics':{'first_two_features':first,'adjacent_by_feature':adjacent},'geometry':geometry}
        size=len(json.dumps(result,separators=(',',':'),allow_nan=False).encode('utf8'))
        if size>staging:
            raise BudgetExceeded('BUDGET_EXCEEDED')
        budget.charge('serialization',ops=size,read_bytes=size,write_bytes=size)
        budget.charge_output(size)
        budget.release_memory(staging-size)
        return result
    except BaseException:
        retained=budget.snapshot()['live_bytes']-before
        if retained>0:
            budget.release_memory(retained)
        raise
