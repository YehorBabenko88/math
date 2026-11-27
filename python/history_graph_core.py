"""Bounded deterministic minimum spanning forest; no market authority."""
from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class ForestV1:
    accepted_edges: tuple
    components: tuple


def kruskal_forest_v1(vertex_ids, weighted_edges, counter):
    if type(vertex_ids) is not tuple or type(weighted_edges) is not tuple:
        raise ValueError("INVALID_SCHEMA")
    n, m = len(vertex_ids), len(weighted_edges)
    if not 1 <= n <= 32 or m > n * (n - 1) // 2:
        raise ValueError("DIMENSION")
    # V owns enforcement. Until its preflight seam exists, fail closed.
    if counter is None or not callable(getattr(counter, "preflight", None)):
        raise ValueError("BUDGET_EXCEEDED")
    # Conservative logical bounds (not native RSS); no partial result.
    memory = 4096 + 512*n + 512*m
    work = 1024*(n+1)*(m+1) + 1024*(m+1)**2
    output = 256*n
    counter.preflight(ops=work, read_bytes=work*4, write_bytes=work*4,
                      live_bytes=memory, output_bytes=output)
    counter.reserve_memory(memory)
    try:
        for v in vertex_ids:
            counter.charge("graph.id", ops=64, read_bytes=64)
            if type(v) is not bytes or not 1 <= len(v) <= 64 or any(c < 32 or c > 126 for c in v):
                raise ValueError("INVALID_SCHEMA")
        for i in range(1,n):
            counter.charge("graph.order", ops=64, read_bytes=128)
            if vertex_ids[i-1] >= vertex_ids[i]:
                raise ValueError("INVALID_SCHEMA")
        edges, seen = [], []
        for edge in weighted_edges:
            counter.charge("graph.edge", ops=1)
            if type(edge) is not tuple or len(edge) != 3:
                raise ValueError("INVALID_SCHEMA")
            u,v,w = edge
            if type(u) is not bytes or type(v) is not bytes or len(u)>64 or len(v)>64:
                raise ValueError("INVALID_SCHEMA")
            counter.charge("graph.lookup", ops=128*n+64, read_bytes=256*n+128)
            if u>=v or u not in vertex_ids or v not in vertex_ids:
                raise ValueError("INVALID_SCHEMA")
            if type(w) is not float or not isfinite(w) or w<0:
                raise ValueError("METRIC_INVALID")
            for pair in seen:
                counter.charge("graph.pair", ops=128, read_bytes=256)
                if pair==(u,v):
                    raise ValueError("INVALID_SCHEMA")
            counter.charge("graph.append", ops=2, write_bytes=264)
            seen.append((u,v))
            key=(0.0 if w==0 else w,u,v)
            edges.append(key)
            j=len(edges)-1
            while j:
                counter.charge("graph.compare", ops=129, read_bytes=272)
                if edges[j-1]<=key:
                    break
                counter.charge("graph.move", ops=2, write_bytes=272)
                edges[j],edges[j-1]=edges[j-1],edges[j]
                j-=1
        counter.charge("graph.init", ops=2*n, write_bytes=16*n)
        parent=list(range(n)); rank=[0]*n
        def root(i):
            while True:
                counter.charge("graph.parent_read", ops=1, read_bytes=8)
                p=parent[i]
                if p==i:
                    return i
                i=p
        accepted=[]
        for w,u,v in edges:
            counter.charge("graph.lookup", ops=128*n, read_bytes=256*n)
            a,b=root(vertex_ids.index(u)),root(vertex_ids.index(v))
            if a==b:
                continue
            counter.charge("graph.rank_read", ops=3, read_bytes=16)
            ra,rb=rank[a],rank[b]
            if ra<rb or (ra==rb and a>b):
                a,b,ra,rb=b,a,rb,ra
            counter.charge("graph.parent_write", ops=1, write_bytes=8)
            parent[b]=a
            if ra==rb:
                counter.charge("graph.rank_write", ops=1, write_bytes=8)
                rank[a]=ra+1
            counter.charge("graph.accept", ops=1, write_bytes=136)
            accepted.append((u,v,w))
        counter.charge("graph.groups_init", ops=n, write_bytes=8*n)
        groups=[[] for _ in range(n)]
        for i,v in enumerate(vertex_ids):
            r=root(i)
            counter.charge("graph.group", ops=1, write_bytes=64)
            groups[r].append(v)
        components=[]
        for i,v in enumerate(vertex_ids):
            r=root(i)
            counter.charge("graph.scan", ops=64, read_bytes=128)
            if groups[r][0]==v:
                counter.charge("graph.component", ops=len(groups[r]), write_bytes=64*len(groups[r]))
                components.append(tuple(groups[r]))
        counter.charge_output(136*len(accepted)+64*n)
        return ForestV1(tuple(accepted),tuple(components))
    finally:
        counter.release_memory(memory)
