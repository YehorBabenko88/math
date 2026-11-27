"""Local counter microbenchmark only; no native resource qualification."""
import json, platform, statistics, time
from math_resource_budget import BudgetCounter, BudgetLimits

def run(n):
    c=BudgetCounter(BudgetLimits(n,0,0,0,0))
    start=time.perf_counter_ns(); cpu=time.process_time_ns()
    for _ in range(n): c.charge('coordinate',ops=1)
    elapsed=time.perf_counter_ns()-start; cpu_elapsed=time.process_time_ns()-cpu
    if c.snapshot()['ops'] != n: raise RuntimeError('count mismatch')
    return {'wall_ns':elapsed,'process_cpu_ns':cpu_elapsed}

if __name__=='__main__':
    for n in (20000,100000,1000000):
        for _ in range(1): run(n)
        samples=[run(n) for _ in range(3)]
        print(json.dumps({'n':n,'platform':platform.platform(),'python':platform.python_version(),'samples':samples,'median_wall_ns':statistics.median(x['wall_ns'] for x in samples),'native_tree_memory':None,'qualification':False}))
