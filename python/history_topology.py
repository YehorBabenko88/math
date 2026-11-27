"""Bounded Rips H0/H1 on previously admitted metric tables.

Developer kernel only: structural checks do not attest metric provenance.
Logical resource units, not native memory or execution authority.
"""
from itertools import combinations
from math import isfinite, copysign


def rips_persistence_v1(vertex_ids, packed_distances, cutoff, *, budget):
    try:
        from math_resource_budget import BudgetCounter
        from history_graph_core import kruskal_forest_v1
    except ImportError as exc:
        raise ValueError("BUDGET_EXCEEDED") from exc
    if type(budget) is not BudgetCounter:
        raise ValueError("BUDGET_EXCEEDED")
    if type(vertex_ids) is not tuple or type(packed_distances) is not tuple:
        raise ValueError("INVALID_SCHEMA")
    n = len(vertex_ids)
    if not 1 <= n <= 32:
        raise ValueError("DIMENSION")
    e = n*(n-1)//2
    t = n*(n-1)*(n-2)//6
    if len(packed_distances) != e:
        raise ValueError("DIMENSION")
    # Dense worst-case filtration; fixed 64-bit words, no bigint bitsets.
    m = n+e+t
    words = (e+63)//64
    memory = 8192 + 512*m + 16*t*words + 32*e
    own_work = 4096 + 256*m*m + 16*(t+1)*(e+1)*(words+1)
    graph_work = 1024*(n+1)*(e+1) + 1024*(e+1)**2
    graph_memory = 4096+512*n+512*e
    output = 64*(n+e)
    budget.preflight(ops=own_work+graph_work, read_bytes=8*own_work+4*graph_work,
                     write_bytes=8*own_work+4*graph_work,
                     live_bytes=memory+graph_memory, output_bytes=output+256*n)
    budget.reserve_memory(memory)
    def charge(kind, ops=1, read=0, write=0):
        budget.charge("rips."+kind, ops=ops, read_bytes=read, write_bytes=write)
    def valid(x):
        return type(x) is float and isfinite(x) and x>=0 and copysign(1.0,x)>0
    def ordered_insert(rows, item):
        charge("append", 1, 0, 64)
        rows.append(item)
        j=len(rows)-1
        while j:
            charge("compare", 8, 128)
            if rows[j-1]<=item:
                break
            charge("move", 2, 0, 128)
            rows[j]=rows[j-1]
            j-=1
        rows[j]=item
    try:
        charge("cutoff", 1, 8)
        if not valid(cutoff):
            raise ValueError("METRIC_INVALID")
        for i,v in enumerate(vertex_ids):
            charge("id", 128, 128)
            if type(v) is not bytes or not 1<=len(v)<=64 or any(c<32 or c>126 for c in v):
                raise ValueError("INVALID_SCHEMA")
            if i and vertex_ids[i-1]>=v:
                raise ValueError("INVALID_SCHEMA")
        matrix=[[0.0]*n for _ in range(n)]
        edges=[]
        graph=[]
        diameter=0.0
        k=0
        for i,j in combinations(range(n),2):
            charge("pair", 8, 8, 32)
            w=packed_distances[k]
            k+=1
            if not valid(w):
                raise ValueError("METRIC_INVALID")
            matrix[i][j]=matrix[j][i]=w
            diameter=max(diameter,w)
            if w<=cutoff:
                ordered_insert(edges,(w,i,j))
                charge("graph_edge", 1, 128, 144)
                graph.append((vertex_ids[i],vertex_ids[j],w))
        forest=kruskal_forest_v1(vertex_ids,tuple(graph),budget)
        # Accepted forest edges kill H0. Remaining edges create H1.
        index={v:i for i,v in enumerate(vertex_ids)}
        tree_edges=set()
        bars=[]
        for u,v,w in forest.accepted_edges:
            charge("forest", 128, 144, 64)
            tree_edges.add((index[u],index[v]))
            if w>0:
                ordered_insert(bars,(0,0.0,w,False))
        censored=cutoff<diameter
        # Use an internal numeric sort key; null deaths emitted at end.
        survivors=[(0,0.0,None,censored) for _ in forest.components]
        edge_index={}
        births=set()
        for k,(w,i,j) in enumerate(edges):
            charge("edge_index", 8, 64, 64)
            edge_index[i,j]=k
            if (i,j) not in tree_edges:
                births.add(k)
        triangles=[]
        for i,j,k in combinations(range(n),3):
            charge("triangle", 8, 24)
            w=max(matrix[i][j],matrix[i][k],matrix[j][k])
            if w<=cutoff:
                ordered_insert(triangles,(w,i,j,k))
        pivots={}
        for w,i,j,k in triangles:
            charge("column", words+8, 24, 8*words)
            col=[0]*words
            for pair in ((i,j),(i,k),(j,k)):
                charge("face", 4, 16, 8)
                b=edge_index[pair]
                col[b//64]^=1<<(b%64)
            while True:
                p=-1
                for q in range(words-1,-1,-1):
                    charge("pivot_scan", 1, 8)
                    if col[q]:
                        p=64*q+col[q].bit_length()-1
                        break
                if p<0:
                    break
                charge("pivot", 2, 16)
                old=pivots.get(p)
                if old is None:
                    if p not in births:
                        raise ValueError("METRIC_INVALID")
                    charge("pivot_store", words+2, 8*words, 8*words)
                    pivots[p]=col
                    birth=edges[p][0]
                    if w>birth:
                        ordered_insert(bars,(1,birth,w,False))
                    break
                for q in range(words):
                    charge("xor_word", 1, 16, 8)
                    col[q]^=old[q]
        for p in range(len(edges)):
            charge("survivor", 4, 16)
            if p in births and p not in pivots:
                survivors.append((1,edges[p][0],None,censored))
        # Finite bars then surviving bars within each dimension, deterministic.
        result=[]
        for dim in (0,1):
            for b in bars:
                charge("emit_scan", 1, 32)
                if b[0]==dim:
                    result.append(b)
            for b in survivors:
                charge("emit_scan", 1, 32)
                if b[0]==dim:
                    result.append(b)
        budget.charge_output(64*len(result))
        return tuple(result)
    finally:
        budget.release_memory(memory)
