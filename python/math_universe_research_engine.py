"""Research bridge over canonical I alignment and C/E geometry; no authority."""
from dataclasses import asdict
from copy import deepcopy
import json
from math_resource_budget import BudgetCounter, BudgetLimits
from history_causal import align, spectral_eligibility
from history_spherical import SphericalError
from math_universe_research_kernel import run_synthetic_geometry_v1
from math_universe_diagnostics import analyze_aligned_support


def run_research_v1(request, *, budget=None):
    """Rows are immutable I Row DTOs; windows and revisions belong to I.

    All successful diagnostics still ABSTAIN: structural applicability does not
    authenticate source data, qualify fits, or authorize trading.
    """
    if type(request) is not dict or set(request) != {'start_ms','end_ms','as_of_ms','cadence_ms','roster','rows'}:
        raise ValueError('RESEARCH_SCHEMA')
    if budget is not None and type(budget) is not BudgetCounter:
        raise TypeError('BudgetCounter required')
    if budget is None:
        budget=BudgetCounter(BudgetLimits(*([10**12]*5)))
    requested={k:request[k] for k in ('start_ms','end_ms','as_of_ms','cadence_ms')}
    # The research geometry envelope is deliberately smaller than I's grid cap.
    start,end,step=(requested[k] for k in ('start_ms','end_ms','cadence_ms'))
    if any(type(x) is not int for x in (start,end,step)) or step<=0 or (end-start)//step>256:
        raise ValueError('RESEARCH_WINDOW')
    if type(request['rows']) is not tuple or len(request['rows'])>20000:
        raise ValueError('RESEARCH_ROWS')
    if type(request['roster']) is not tuple or not 1<=len(request['roster'])<=32:
        raise ValueError('RESEARCH_ROSTER')
    # Conservative logical quote covers caller input custody, I dictionaries,
    # ledger/selected copies, asdict snapshots, JSON staging and returned DTO.
    # I independently enforces <=128 ASCII chars per identifier and finite floats.
    # No alignment, row copying or serialization occurs before this reservation.
    cells=max(0,(end-start)//step)*len(request['roster'])
    input_bytes=len(request['rows'])*512+len(request['roster'])*128
    staging=65536+len(request['rows'])*4096+cells*512
    before=budget.snapshot()['live_bytes'] if budget else 0
    try:
        if budget:
            budget.preflight(ops=len(request['rows'])+cells,read_bytes=input_bytes,
                             write_bytes=staging,live_bytes=staging)
            budget.reserve_memory(staging)
            budget.charge('enumeration',ops=len(request['rows'])+cells,
                          read_bytes=input_bytes,write_bytes=staging)
        aligned=align(request['rows'],roster=request['roster'],start_ms=start,end_ms=end,step_ms=step,as_of_ms=requested['as_of_ms'])
        geometry=None
        diagnostics=None
        applicable=not aligned['gaps'] and len(aligned['support'])>=2 and len(request['roster']) in (4,32)
        reason='INCOMPLETE_AS_OF_WINDOW' if aligned['gaps'] else 'UNQUALIFIED_SOURCE_AND_FIT'
        if applicable:
            try:
                with run_synthetic_geometry_v1(tuple(p[1] for p in aligned['support']),tuple(p[0] for p in aligned['support']),radius=1.0,cadence_ms=step,budget=budget) as lease:
                    # Established E lease custody ends only after detaching a
                    # snapshot into this engine's pre-reserved staging custody.
                    geometry=deepcopy(lease.result)
            except SphericalError as exc:
                applicable=False
                reason=exc.code
            diagnostics=analyze_aligned_support(aligned['support'],budget=budget)
        alignment={**aligned,'selected':tuple(asdict(r) for r in aligned['selected']),
                   'ledger':tuple(asdict(r) for r in aligned['ledger'])}
        result={'schema':'math.universe.research.result.v1','status':'ABSTAIN','authority':'NONE',
                'qualified':False,'requested':requested,'gaps':aligned['gaps'],'alignment':alignment,
                'applicability':{'geometry':applicable,'spectral':spectral_eligibility(aligned,min_samples=3)},
                'geometry':geometry,'diagnostics':diagnostics,'reason':reason,'source_authenticity':'NOT_EVALUATED_BY_MATH'}
        if budget:
            size=len(json.dumps(result,separators=(',',':'),allow_nan=False).encode())
            child_size=0  # Detached geometry now belongs to engine staging.
            if diagnostics:
                child_size+=len(json.dumps(diagnostics,separators=(',',':'),allow_nan=False).encode())
            envelope=size-child_size
            if envelope>staging:
                # Defensive refusal if the versioned conservative profile drifts.
                from math_resource_budget import BudgetExceeded
                raise BudgetExceeded('BUDGET_EXCEEDED')
            budget.charge_output(envelope)
            # Transfer staging custody to the retained envelope without a second
            # allocation quote or refund of consumed operation/I/O credits.
            budget.release_memory(staging-envelope)
        return result
    except BaseException:
        if budget:
            retained=budget.snapshot()['live_bytes']-before
            if retained>0:
                budget.release_memory(retained)
        raise
