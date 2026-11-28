"""Fresh-process CPU/wall/native peak RSS and canonical logical V measurements."""
from pathlib import Path
import json
import os
import platform
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'python'))


def native_peak():
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        class Counters(ctypes.Structure):
            _fields_=[('cb',wintypes.DWORD),('PageFaultCount',wintypes.DWORD)]+[(name,ctypes.c_size_t) for name in ('PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage')]
        value=Counters();value.cb=ctypes.sizeof(value)
        current=ctypes.windll.kernel32.GetCurrentProcess
        current.restype=wintypes.HANDLE
        get=ctypes.windll.psapi.GetProcessMemoryInfo
        get.argtypes=[wintypes.HANDLE,ctypes.POINTER(Counters),wintypes.DWORD]
        if not get(current(),ctypes.byref(value),value.cb):
            raise OSError('Native memory query failed')
        return value.PeakWorkingSetSize
    import resource
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*(1 if sys.platform=='darwin' else 1024)


def child(dimension,count):
    from history_causal import Row
    from math_resource_budget import BudgetLimits,BudgetCounter
    from math_universe_research_engine import run_research_v1
    budget=BudgetCounter(BudgetLimits(*([10**12]*5)))
    roster=tuple(f'f{i}' for i in range(dimension))
    rows=tuple(Row(s,'synthetic',t*1000,t*1000+1,0,float((i+t)%7+1)) for t in range(1,count+1) for i,s in enumerate(roster))
    cpu=time.process_time_ns();wall=time.perf_counter_ns()
    result=run_research_v1(dict(start_ms=0,end_ms=count*1000,as_of_ms=count*1000+2,cadence_ms=1000,roster=roster,rows=rows),budget=budget)
    return dict(dimension=dimension,samples=count,status=result['status'],wall_ns=time.perf_counter_ns()-wall,cpu_ns=time.process_time_ns()-cpu,native_peak_rss_bytes=native_peak(),logical_budget=budget.snapshot(),logical_policy='Python engine, generous 1e12 credits, excludes JS process',platform=platform.platform(),python=platform.python_version())


if __name__=='__main__':
    if len(sys.argv)==3:
        print(json.dumps(child(int(sys.argv[1]),int(sys.argv[2]))))
    else:
        for dimension,count in ((4,3),(4,32),(32,3),(32,32),(4,256)):
            run=subprocess.run([sys.executable,'-I','-B',str(Path(__file__).resolve()),str(dimension),str(count)],capture_output=True,text=True,timeout=60)
            if run.returncode:
                raise RuntimeError(run.stderr)
            print(run.stdout.strip(),flush=True)
